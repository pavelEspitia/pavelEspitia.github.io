---
title: "Reentrancy in 2026: Why It Still Drains Millions (and How AI Spots It)"
tags: ["web3","solidity","security","ai"]
publish: false
---

Reentrancy is the oldest trick in smart contract exploitation. The DAO fell to it in 2016. You would think a bug this famous would be extinct by now. It isn't. Protocols still lose millions to reentrancy every year, because the textbook version is the easy one, and attackers stopped using the textbook version a long time ago.

This post walks through the classic bug, then the modern variants that still bite in 2026: cross-function, cross-contract, read-only reentrancy through view functions, and callback reentrancy through ERC777 and ERC721. I'll show why `ReentrancyGuard` is not the silver bullet most developers think it is, and how an LLM-based auditor reasons about the call-then-state-change pattern in a way pattern matchers can't.

## The Classic: Single-Function Reentrancy

Here is the canonical vulnerable withdraw.

```solidity
contract VulnerableVault {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "transfer failed");
        balances[msg.sender] = 0; // state update AFTER the external call
    }
}
```

The attack is simple. The attacker is a contract. When `withdraw` sends ETH via `msg.sender.call`, control passes to the attacker's `receive()` function before `balances[msg.sender]` is zeroed. The attacker calls `withdraw` again. The balance is still the original amount, so the vault pays out again. Repeat until the vault is empty.

```solidity
contract Attacker {
    VulnerableVault vault;

    receive() external payable {
        if (address(vault).balance >= 1 ether) {
            vault.withdraw(); // re-enter before balance is zeroed
        }
    }
}
```

The fix is checks-effects-interactions. Do all your checks, then update all your state, and only then make the external call.

```solidity
function withdraw() external {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;   // effect first
    (bool success, ) = msg.sender.call{value: amount}(""); // interaction last
    require(success, "transfer failed");
}
```

Now when the attacker re-enters, the balance is already zero, the second payout is zero, and the drain stops. You can also add OpenZeppelin's `ReentrancyGuard`:

```solidity
function withdraw() external nonReentrant {
    uint256 amount = balances[msg.sender];
    balances[msg.sender] = 0;
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "transfer failed");
}
```

If reentrancy were only this, it would be a solved problem. Every linter on earth flags a state write after an external call. The reason millions still vanish is that the modern variants slip past both the guard and the linter.

## Cross-Function Reentrancy

`nonReentrant` locks a single function. But contracts share state across many functions, and a mutex on `withdraw` does nothing if the attacker re-enters through a *different* function that reads the same balance.

```solidity
contract Vault {
    mapping(address => uint256) public balances;

    function withdraw() external nonReentrant {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;
    }

    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount); // stale balance here
        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}
```

`withdraw` has the guard. But during the external call, `balances[msg.sender]` is still the full pre-withdrawal amount. The attacker's `receive()` calls `transfer` instead of `withdraw`. `transfer` is not guarded by the same lock (the default `nonReentrant` only blocks re-entry into functions sharing that specific modifier instance, and many codebases forget to add it everywhere). The attacker transfers their still-intact balance to a second wallet, then lets `withdraw` finish and zero out the original account. They now hold the funds twice.

The fix is the same root principle: update state before the external call. `withdraw` must zero the balance first. The guard is a backstop, not the actual fix.

## Cross-Contract Reentrancy

Now the shared state lives in two contracts. Protocol A holds the accounting, Protocol B holds the funds, and the lock on one says nothing about the other.

```solidity
contract Pool {
    Token public token;
    mapping(address => uint256) public shares;

    function redeem() external nonReentrant {
        uint256 amount = shares[msg.sender];
        token.transfer(msg.sender, amount); // ERC777-style callback fires here
        shares[msg.sender] = 0;
    }
}
```

If `token` invokes a hook on the recipient (more on that below), the attacker re-enters during `token.transfer`. They can't re-enter `redeem` because of the guard, but they can call into a *different* contract that trusts `Pool.shares[msg.sender]` as an oracle of how much they own. That second contract has no idea `Pool` is mid-execution. It reads the stale, still-nonzero share balance and lets the attacker borrow or mint against value they are about to remove.

## Read-Only Reentrancy: The One Guards Cannot Catch

This is the variant that has done the most damage since 2022, and it is the one that defeats `ReentrancyGuard` by design.

`nonReentrant` protects state-mutating functions. View functions are not guarded, because views don't write state, so reentering them looks harmless. The problem: a view function can return a value computed from state that is temporarily inconsistent during an external call.

Consider an AMM-style pool whose `getVirtualPrice()` derives a price from the contract's token balances and total supply.

```solidity
contract StablePool {
    uint256 public totalSupply;

    function removeLiquidity(uint256 lpAmount) external nonReentrant {
        uint256 ethOut = (lpAmount * address(this).balance) / totalSupply;
        _burn(msg.sender, lpAmount);
        (bool ok, ) = msg.sender.call{value: ethOut}(""); // attacker re-enters here
        totalSupply -= lpAmount; // supply not yet updated during the call
    }

    function getVirtualPrice() external view returns (uint256) {
        return (address(this).balance * 1e18) / totalSupply; // reads inconsistent state
    }
}
```

During `removeLiquidity`, the ETH has already left the contract via the `call`, but `totalSupply` has not yet been decremented. For the duration of that external call, `getVirtualPrice()` returns a value based on a reduced balance divided by an unchanged supply: a deflated, wrong price.

The attacker's `receive()` does not re-enter `StablePool` at all. It calls a *lending protocol* that uses `getVirtualPrice()` as its oracle. That protocol is fully patched, fully guarded, written by a different team. It simply trusts the view function. The attacker borrows against the manipulated price, the call returns, `removeLiquidity` finishes and restores `totalSupply`, and the lending protocol is left holding an undercollateralized loan.

This is why guards alone miss read-only reentrancy. `StablePool` is guarded. The lending protocol is guarded. The vulnerability lives in the *interaction*: a view function reading half-updated state, consumed by a third party who never sees the lock. The only real fix is to never leave state inconsistent across an external call. Burn and decrement `totalSupply` before the `call`, or have the consuming protocol take the pool's own reentrancy lock before reading the price (Curve added `remove_liquidity` reentrancy checks readable by integrators for exactly this reason).

## Callback Reentrancy: ERC777 and ERC721

Plain ERC20 `transfer` does not hand control to the recipient. ERC777 and ERC721 do, and that turns an innocent-looking token movement into an external call.

ERC777 invokes `tokensReceived` on the recipient. ERC721 `safeTransferFrom` invokes `onERC721Received`. Both are attacker-controlled entry points.

```solidity
contract NFTMint {
    mapping(address => bool) public hasMinted;
    uint256 public totalMinted;

    function mint() external {
        require(!hasMinted[msg.sender], "already minted");
        totalMinted++;
        _safeMint(msg.sender, totalMinted); // calls onERC721Received
        hasMinted[msg.sender] = true;       // flag set AFTER the callback
    }
}
```

`_safeMint` calls `onERC721Received` on the minter before `hasMinted[msg.sender]` is set. The attacker re-enters `mint` from inside that callback, passes the `require` again (flag still false), and mints as many NFTs as gas allows. This exact shape drained limited mints and bypassed per-wallet caps repeatedly. The fix, again, is ordering: set `hasMinted[msg.sender] = true` before `_safeMint`.

## Why This Defeats Pattern Matchers

A static analyzer flags "state write after external call" inside one function. That catches the classic case and nothing else. The variants above share a deeper property that no regex encodes:

1. The dangerous call and the stale state can live in **different functions**.
2. The dangerous call and the stale read can live in **different contracts**.
3. The "external call" can be **disguised** as a token transfer (`safeMint`, ERC777 `transfer`) that a pattern matcher does not even recognize as reentrant.
4. The victim of read-only reentrancy is a **third-party integrator** that contains no bug of its own.

These are not pattern problems. They are reasoning problems. You have to model what state is inconsistent at the moment control leaves the contract, and who else reads that state.

## How an LLM-Based Auditor Reasons About It

This is the gap I built spectr-ai to close. Instead of matching `call(...)` followed by a storage write, the engine reasons about the sequence:

- It identifies every point where control can leave the contract, including the disguised ones: low-level `call`, `safeTransferFrom`, ERC777 `transfer`, and any external call to a contract it cannot prove is trusted.
- For each exit point, it asks what state is half-updated at that instant, then checks whether *any other function or view* reads that state. That is how it surfaces cross-function and read-only reentrancy that a single-function rule never sees.
- It flags view functions that compute prices or balances from mutable state and warns that integrators reading them mid-call get inconsistent values, the read-only reentrancy signature.

It is the same approach from my earlier post on the five vulnerability classes AI catches: reason about intent and cross-function interaction, not just local patterns.

```bash
# Free, local, no API key needed
ollama pull qwen2.5-coder:1.5b
npx spectr-ai --model ollama:qwen2.5-coder:1.5b your-contract.sol
```

## The Takeaway

Checks-effects-interactions is still the foundation: update all state before any external call, every time, in every function. `ReentrancyGuard` is a backstop, not a fix, and it is blind to read-only reentrancy by design because view functions are never locked. The variants that drain millions in 2026 are the cross-function, cross-contract, and read-only cases where the bug lives in the seam between contracts rather than in any single line.

Run your deterministic tools for the obvious writes-after-call. Then run an auditor that can reason across functions and contracts for the ones that hide in the seams.

[spectr-ai](https://github.com/pavelEspitia/spectr-ai) is open source and works with Claude or local models via Ollama.
