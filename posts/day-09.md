# Solidity vs Vyper: Security Differences Every Auditor Should Know

When I started building spectr-ai, one of the first decisions was which EVM languages to support. Solidity was obvious — it powers over 90% of deployed contracts. But Vyper kept showing up in DeFi protocols I was auditing, and the security differences between the two languages are more significant than most developers realize.

This post breaks down where each language helps (and hurts) your contract's security posture, with concrete code examples.

## Solidity's Footgun Collection

Solidity gives you enormous power and enormous rope to hang yourself with. Here are the features that keep auditors employed.

### delegatecall

`delegatecall` executes another contract's code in the context of the calling contract. This means the called contract can modify the caller's storage. It's the backbone of upgradeable proxies — and the source of hundreds of millions in losses.

```solidity
// Dangerous: anyone can call this and change contract storage
contract Vulnerable {
    address public owner;

    function execute(address target, bytes memory data) public {
        (bool success, ) = target.delegatecall(data);
        require(success);
    }
}
```

An attacker deploys a malicious contract that sets `owner` to their address, then calls `execute` pointing to it. Game over.

### tx.origin

`tx.origin` returns the original external account that initiated the transaction, not the immediate caller. This breaks when contracts call other contracts.

```solidity
// Vulnerable to phishing attacks
function withdraw() public {
    require(tx.origin == owner, "Not owner");
    payable(msg.sender).transfer(address(this).balance);
}
```

If the owner interacts with a malicious contract, that contract can call `withdraw` and the `tx.origin` check passes because the owner initiated the transaction chain.

### Inline Assembly

Solidity's `assembly` blocks give you raw EVM access. No type safety, no overflow checks, no guard rails.

```solidity
function unsafeAdd(uint256 a, uint256 b) public pure returns (uint256) {
    assembly {
        mstore(0x0, add(a, b))  // No overflow check
        return(0x0, 32)
    }
}
```

### selfdestruct

`selfdestruct` removes a contract from the blockchain and force-sends its ETH balance to any address. This bypasses `receive()` and `fallback()` functions, breaking contracts that rely on `address(this).balance` for logic.

```solidity
// This invariant can be broken by selfdestruct
function isBalanceCorrect() public view returns (bool) {
    return address(this).balance == totalDeposits;
}
```

Note: `selfdestruct` behavior changed after EIP-6780 (Dencun upgrade), but force-sending ETH still works during the creation transaction.

## Vyper's Safety-by-Design Philosophy

Vyper takes the opposite approach: remove dangerous features entirely. No inheritance, no operator overloading, no inline assembly, no function overloading, and bounded loops only.

### Bounded Loops

Vyper requires loop bounds at compile time. You literally cannot write an unbounded loop.

```python
# Vyper: must specify max iterations
@external
def sum_deposits(deposits: DynArray[uint256, 100]) -> uint256:
    total: uint256 = 0
    for deposit: uint256 in deposits:
        total += deposit
    return total
```

Compare that to Solidity, where an unbounded loop over a growing array is a classic gas griefing vector:

```solidity
// Solidity: nothing stops you from iterating forever
function sumDeposits() public view returns (uint256) {
    uint256 total = 0;
    for (uint256 i = 0; i < deposits.length; i++) {
        total += deposits[i];  // Gas bomb if array grows large
    }
    return total;
}
```

### No Inheritance

Vyper has no inheritance. This sounds limiting until you realize that inheritance is a major source of audit complexity. Diamond inheritance, storage layout conflicts between parent contracts, and shadowed functions have caused real exploits.

In Vyper, every contract is flat. What you see is what you get.

### Default Overflow Protection

Both languages now have overflow protection by default (Solidity since 0.8.0, Vyper since inception), but Vyper had it from day one. In Solidity, developers can still opt out with `unchecked` blocks — and they do, often incorrectly, to save gas.

```solidity
// Solidity: developers can bypass overflow checks
function riskyMath(uint256 a, uint256 b) public pure returns (uint256) {
    unchecked {
        return a - b;  // Wraps on underflow
    }
}
```

Vyper has no equivalent escape hatch.

## Vyper Is Not Immune

Vyper's safety-first design reduces the attack surface, but it does not eliminate it.

### raw_call

Vyper's `raw_call` is analogous to Solidity's low-level `call`. It gives you the same reentrancy and return-data risks.

```python
# Vyper: raw_call is just as dangerous as Solidity's .call()
@external
def forward_call(target: address, data: Bytes[1024]):
    raw_call(target, data)  # No reentrancy guard
```

### The Reentrancy Lock Bug (2023)

In July 2023, a compiler bug in Vyper versions 0.2.15, 0.2.16, and 0.3.0 broke the `@nonreentrant` decorator. The reentrancy lock was not properly enforced, leading to exploits on several Curve Finance pools and roughly $70M in losses.

This is a crucial lesson: language-level safety features are only as reliable as the compiler that implements them.

### Storage Collisions in Older Versions

Before Vyper 0.4.0, storage slot assignments could collide when using certain patterns with `DynArray` and mappings. The compiler has since fixed this, but contracts deployed with older versions remain vulnerable.

### Default Visibility

In Vyper, functions without a decorator default to `@internal`. In Solidity, functions default to `public` (prior to 0.5.0, they defaulted to `public` — a common footgun). However, Vyper's `@external` decorator is still easy to misapply:

```python
# Vyper: accidentally exposing an admin function
@external
def set_fee(new_fee: uint256):
    # Forgot access control — anyone can call this
    self.fee = new_fee
```

The language does not enforce access control; that is still the developer's job.

## The Same Vulnerability in Both Languages

Let's look at a classic reentrancy bug implemented in both languages.

**Solidity:**

```solidity
contract VulnerableVault {
    mapping(address => uint256) public balances;

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
        balances[msg.sender] = 0;  // State update AFTER external call
    }
}
```

**Vyper:**

```python
balances: public(HashMap[address, uint256])

@external
def withdraw():
    amount: uint256 = self.balances[msg.sender]
    raw_call(msg.sender, b"", value=amount)
    self.balances[msg.sender] = 0  # Same bug: state update after call
```

Both are vulnerable to reentrancy. The fix is the same in both languages: update state before making external calls (checks-effects-interactions pattern), or use a reentrancy lock.

## What This Means for Auditors

When auditing Solidity, your checklist is longer. You need to check for `delegatecall` misuse, `selfdestruct` edge cases, `tx.origin` phishing, inline assembly correctness, inheritance conflicts, and unchecked arithmetic.

When auditing Vyper, the attack surface is smaller, but you need to verify the compiler version (especially for the reentrancy lock bug), check `raw_call` usage, and still look for access control issues and logic errors that no language can prevent.

In spectr-ai, we weight findings differently based on the source language. A `delegatecall` in Solidity triggers a high-severity check. In Vyper, that pattern does not exist, so the engine focuses on `raw_call` patterns and compiler-version-specific issues instead.

## The Takeaway

Vyper is genuinely safer by default. If your contract does not need Solidity's advanced features (upgradeable proxies, complex inheritance hierarchies, inline assembly optimizations), Vyper reduces the surface area an attacker can probe.

But "safer by default" is not "safe." The Curve exploit proved that compiler bugs can undermine language-level guarantees. No matter the language, the fundamentals still apply: checks-effects-interactions, access control, input validation, and — ideally — a thorough audit by both AI and human reviewers.

The best security comes from using the right tool for the job and understanding the specific risks of whichever language you choose.
