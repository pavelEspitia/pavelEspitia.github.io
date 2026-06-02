---
title: "Foundry Invariant Testing: Finding Bugs Fuzzing Can't"
tags: ["web3","solidity","testing","security"]
publish: false
---

Your fuzz tests pass. Your unit tests pass. Coverage is green. Then the protocol goes live and someone drains the vault with a five-transaction sequence you never tested.

That's the gap invariant testing fills. Unit tests check one path. Fuzz tests check one call with random inputs. Invariant tests check that a property *holds no matter what sequence of calls anyone throws at your contract*. That last category catches the bugs that actually drain money, because real exploits are almost never a single call. They're a chain.

This post walks through stateful invariant testing in Foundry with runnable code: a simple vault, an invariant that should always hold, a handler to bound the chaos, and how to read the failing call sequence Foundry hands you when it breaks the invariant.

## Three kinds of test, increasing power

| Test type | Prefix | What varies | What it checks |
|---|---|---|---|
| Unit | `test_` | Nothing (you pick inputs) | One specific path |
| Stateless fuzz | `testFuzz_` | Inputs to one call | One call, many inputs |
| Stateful invariant | `invariant_` | Inputs *and* call sequence | A property across random sequences |

Here's the same vault tested three ways so the difference is concrete.

```solidity
// test/Vault.t.sol
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../src/Vault.sol";

contract VaultTest is Test {
    Vault vault;

    function setUp() public {
        vault = new Vault();
    }

    // 1. Unit test: I pick everything
    function test_deposit() public {
        vault.deposit{value: 1 ether}();
        assertEq(vault.shares(address(this)), 1 ether);
    }

    // 2. Stateless fuzz: Foundry picks the input, runs ONE deposit
    function testFuzz_deposit(uint256 amount) public {
        amount = bound(amount, 1, 100 ether);
        vm.deal(address(this), amount);
        vault.deposit{value: amount}();
        assertEq(vault.shares(address(this)), amount);
    }
}
```

The fuzz test is strictly better than the unit test: it tries thousands of deposit amounts. But notice what it still can't see. It does one deposit, in isolation, from a fresh contract. It never deposits, withdraws, has another user deposit, then withdraws again. The bugs that matter live in that interleaving.

## The vault we'll break

A minimal share-based vault. Deposit ETH, get shares. Burn shares, get ETH back. Looks fine.

```solidity
// src/Vault.sol
pragma solidity ^0.8.20;

contract Vault {
    mapping(address => uint256) public shares;
    uint256 public totalShares;

    function deposit() external payable {
        uint256 minted = totalShares == 0
            ? msg.value
            : (msg.value * totalShares) / address(this).balance;
        shares[msg.sender] += minted;
        totalShares += minted;
    }

    function withdraw(uint256 amount) external {
        require(shares[msg.sender] >= amount, "insufficient");
        uint256 payout = (amount * address(this).balance) / totalShares;
        shares[msg.sender] -= amount;
        totalShares -= amount;
        (bool ok, ) = msg.sender.call{value: payout}("");
        require(ok, "transfer failed");
    }
}
```

There's a subtle bug in here. You probably can't spot it by reading, and neither could a unit test author who only writes the happy path. Invariant testing finds it in seconds.

## Writing the invariant

An invariant is a property that must be true after *every* possible call, in *every* possible order. For a vault, the obvious solvency invariant is:

> The contract's ETH balance must always cover what it owes. Assets >= liabilities.

For this share model, the cleanest invariant is: **if anyone holds shares, the contract holds ETH.** You should never be in a state where `totalShares > 0` but `address(this).balance == 0`, because that means shareholders own claims against nothing.

```solidity
// test/VaultInvariant.t.sol
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../src/Vault.sol";

contract VaultInvariantTest is Test {
    Vault vault;

    function setUp() public {
        vault = new Vault();
        targetContract(address(vault));
    }

    // Solvency: shares outstanding implies ETH backing them
    function invariant_solvency() public view {
        if (vault.totalShares() > 0) {
            assertGt(address(vault).balance, 0, "shares exist but no ETH");
        }
    }
}
```

`targetContract` tells Foundry which contract to bombard with random calls. Run it:

```bash
forge test --match-contract VaultInvariantTest -vvv
```

Foundry generates random sequences of `deposit` and `withdraw` calls with random arguments and random sender addresses, then checks `invariant_solvency` after each call. If the property ever breaks, it prints the exact sequence that broke it.

## Reading the failing call sequence

When the invariant fails, Foundry gives you the reproduction directly:

```
[FAIL: shares exist but no ETH]
	[Sequence]
		sender=0x0000...0a addr=Vault calldata=deposit() value=3
		sender=0x0000...1f addr=Vault calldata=withdraw(2) value=0
		sender=0x0000...0a addr=Vault calldata=withdraw(1) value=0

  invariant_solvency() (runs: 256, calls: 3840, reverts: 1201)
```

Read that bottom-up. `runs: 256` is how many independent sequences it tried. `calls: 3840` is total calls across all runs. `reverts: 1201` means many random calls reverted (expected, since random `withdraw` amounts usually exceed balances). The `[Sequence]` block is the shrunk, minimal series of calls that triggered the failure. Foundry shrinks it for you, so you get the shortest path to the bug, not the raw 50-call run.

Drop that sequence into a standalone unit test and you have a permanent regression test for the exact bug. That's the workflow: invariant test discovers, you copy the sequence into a `test_` for the fix.

The bug itself: division truncation in `deposit` and `withdraw` lets `totalShares` go positive while the contract's balance rounds down toward zero across a sequence of small deposits and withdrawals. A single fuzzed call can't reach that state. It needs the *interleaving* of multiple users and multiple withdrawals, which is exactly what stateful testing explores.

## Handlers: stop wasting runs on reverts

Notice `reverts: 1201` above. More than a quarter of the random calls reverted. That's wasted work. Pointing Foundry directly at the vault means it calls `withdraw` with absurd amounts from accounts holding zero shares, and those just revert without exercising anything.

The fix is a **handler contract**: a thin wrapper that bounds inputs and only makes calls that can realistically succeed. Foundry targets the handler instead of the vault.

```solidity
// test/handlers/VaultHandler.sol
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../../src/Vault.sol";

contract VaultHandler is Test {
    Vault public vault;

    // Ghost variable: track total ETH ever deposited
    uint256 public ghost_depositSum;

    address[] internal actors;
    address internal currentActor;

    modifier useActor(uint256 seed) {
        currentActor = actors[bound(seed, 0, actors.length - 1)];
        vm.startPrank(currentActor);
        _;
        vm.stopPrank();
    }

    constructor(Vault _vault) {
        vault = _vault;
        for (uint256 i = 0; i < 4; i++) {
            actors.push(makeAddr(string(abi.encodePacked("actor", i))));
        }
    }

    function deposit(uint256 seed, uint256 amount) external useActor(seed) {
        amount = bound(amount, 1, 10 ether);
        vm.deal(currentActor, amount);
        vault.deposit{value: amount}();
        ghost_depositSum += amount;
    }

    function withdraw(uint256 seed, uint256 amount) external useActor(seed) {
        uint256 bal = vault.shares(currentActor);
        if (bal == 0) return;            // skip impossible calls
        amount = bound(amount, 1, bal);  // only withdraw what you hold
        vault.withdraw(amount);
    }
}
```

Three things are doing real work here:

1. **`bound(amount, 1, bal)`** keeps `amount` inside the legal range. `bound` maps any random `uint256` into `[min, max]` without throwing away the run. Never use `vm.assume` for ranges this tight, it discards too many runs and slows the suite to a crawl.
2. **`useActor`** rotates between a fixed set of accounts via `vm.startPrank`, so the random sequences actually model multiple users interacting, which is where the interleaving bugs hide.
3. **Ghost variables** (`ghost_depositSum`) accumulate state the contract doesn't track itself. You can assert against them in the invariant, for example "total deposited minus total withdrawn equals current balance," which catches accounting drift the contract alone can't reveal.

Wire the handler in and restrict targeting to the functions you want:

```solidity
// test/VaultInvariant.t.sol (updated setUp)
import "./handlers/VaultHandler.sol";

VaultHandler handler;

function setUp() public {
    vault = new Vault();
    handler = new VaultHandler(vault);

    targetContract(address(handler));

    // Only fuzz these two selectors on the handler
    bytes4[] memory selectors = new bytes4[](2);
    selectors[0] = handler.deposit.selector;
    selectors[1] = handler.withdraw.selector;
    targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
}
```

`targetSelector` narrows the fuzzer to exactly the handler functions you wrote, so it never calls internal helpers or view functions by accident. Now nearly every generated call is a valid, state-changing operation. The revert count drops, and each run explores meaningful states instead of bouncing off `require` checks.

## Tuning foundry.toml

Invariant runs are controlled separately from regular fuzzing. The two knobs that matter:

```toml
# foundry.toml
[invariant]
runs = 256        # independent sequences to generate
depth = 128       # calls per sequence
fail_on_revert = false  # don't treat handler reverts as failures
```

- **`runs`** is how many fresh sequences Foundry tries. More runs, more coverage, slower CI.
- **`depth`** is how many calls per sequence. This is the lever that matters most for finding deep bugs. A bug that needs eight interleaved operations to manifest will never show up at `depth = 4`. Bump depth when you suspect multi-step state corruption.
- **`fail_on_revert`** decides whether a reverting call fails the whole invariant. Keep it `false` while developing the handler (reverts are noise), flip it to `true` once your handler is tight enough that *any* revert genuinely signals a bug.

A practical starting point for a real protocol: `runs = 500`, `depth = 100`. Then watch the `calls` count in the output. If most calls are reverting, your handler bounding is too loose, not your invariant.

## Why this catches what fuzzing misses

Stateless fuzzing resets state between every test. It asks "given a fresh contract, does this one call with this one input behave?" Invariant testing asks "given a contract that's been hammered by 100 random operations from 4 different users, does this property still hold?"

Almost every high-value exploit is the second question. Reentrancy chains, rounding-error accumulation, share-price manipulation, donation attacks, accounting drift across deposits and withdrawals: none of them reproduce in a single call. They require a *sequence*, and the bug only appears in the accumulated state. That's the entire category stateless tests are blind to.

When I'm auditing a protocol or building detection into spectr-ai, the solvency invariant ("assets >= liabilities, always") is one of the first things I reach for, because it's the property an attacker is ultimately trying to violate. If you can write an invariant and Foundry can break it, you found the bug before mainnet did.

## The takeaway

1. Write unit tests for known paths, fuzz tests for input ranges, and invariant tests for properties that must hold across *all* sequences.
2. Start with a solvency invariant: assets >= liabilities. It maps directly to what attackers want to break.
3. Use a handler with `bound()` and rotating actors so the fuzzer spends runs on valid, state-changing calls instead of reverts.
4. Add ghost variables to assert accounting properties the contract doesn't track itself.
5. Crank `depth` before `runs` when you suspect a multi-step bug. Read the shrunk failing sequence and turn it into a permanent regression test.

Unit and fuzz tests prove your functions work in isolation. Invariant tests prove your system stays correct under chaos. The bugs that drain protocols live in the chaos.

If you want to see invariant-style reasoning applied automatically to contracts you didn't write, that's part of what I'm building into spectr-ai: https://github.com/pavelEspitia/spectr-ai
