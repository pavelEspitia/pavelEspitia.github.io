---
title: "Foundry Fuzzing vs Invariant Testing: When Each One Finds the Bug"
tags: ["security", "blockchain", "solidity", "testing"]
publish: false
---

Foundry gives you two automated testing tools that sound similar and find very different bugs: property fuzzing and invariant testing. I see people reach for one when they need the other and conclude "fuzzing didn't find anything" when the bug was never in fuzzing's reach. Here is the difference, with the kind of bug each one actually catches.

## Fuzzing: random inputs to one function

A fuzz test takes parameters, and Foundry throws hundreds of random values at them, looking for an assertion that breaks:

```solidity
function testFuzz_depositThenWithdraw(uint256 amount) public {
    amount = bound(amount, 1, 1e24);     // keep inputs in a sane range
    vault.deposit{value: amount}();
    vault.withdraw(amount);
    assertEq(address(vault).balance, 0); // property: deposit+withdraw nets to zero
}
```

Foundry runs this with many random `amount` values. If some value breaks the property (an off-by-one in the math, an overflow at a boundary, a precision loss when `amount` is tiny), it finds the counterexample and shrinks it to the minimal failing input.

Fuzzing is excellent at finding edge cases in a *single operation*. The boundary value, the zero, the max, the value that triggers a rounding error. It is testing "for all inputs to this function, does this property hold?"

## Where fuzzing misses

Fuzzing tests one call (or a fixed sequence you wrote). It does not explore *sequences* of operations in an order you did not anticipate. The bugs that live in "deposit, then someone else withdraws, then you transfer, then you withdraw again" are sequence bugs, and a single-function fuzz test will never stumble into that ordering.

That is exactly the class of bug that drains protocols: not a bad input to one function, but a bad *interleaving* of several functions across several actors.

## Invariant testing: random sequences across the whole system

Invariant testing flips the model. Instead of fuzzing inputs to one function, Foundry calls *many* functions in *random order* with *random inputs*, across the whole contract, and after every call it checks that a system-wide invariant still holds:

```solidity
contract VaultInvariants is Test {
    Vault vault;

    function setUp() public {
        vault = new Vault();
        targetContract(address(vault)); // Foundry calls its functions randomly
    }

    // This must be true after ANY sequence of operations
    function invariant_solvency() public view {
        assertGe(address(vault).balance, vault.totalDeposits());
    }
}
```

`invariant_solvency` says: the vault's actual balance must always cover what it owes depositors. Foundry now runs thousands of random call sequences (deposits, withdrawals, transfers, in every order it can think of) and checks solvency after each one. If any sequence breaks solvency, you have found a bug that no single-function test would surface.

This is how you catch the "withdraw twice through a reentrant path" or "the accounting drifts after this specific interleaving" bugs. The invariant is the property that should survive any history, and Foundry attacks the history.

## Choosing the invariant is the hard part

Writing the test is easy. Choosing the right invariant is the skill. Good invariants are global truths about the system that should never be violated:

- Solvency: assets held >= liabilities owed.
- Conservation: total supply equals the sum of balances.
- Monotonicity: a nonce only increases, never resets.
- Access: only authorized roles ever changed a privileged variable.

A weak invariant (one that is trivially true) passes forever and tests nothing. A strong invariant (solvency) is where the real bugs hide, because it constrains the whole system at once.

## Handler contracts: making the random calls realistic

Out of the box, invariant testing calls functions with fully random arguments, which often just reverts (you cannot withdraw from an account with no balance). To get useful coverage you write a *handler*: a wrapper that makes the random calls plausible, tracking ghost state so withdrawals target accounts that actually have balances. The handler is what turns invariant testing from "everything reverts" into "realistic sequences that actually exercise the logic."

```solidity
contract Handler is Test {
    Vault vault;
    uint256 public ghostDeposited; // track what we've put in

    function deposit(uint256 amount) public {
        amount = bound(amount, 1, 1e22);
        vault.deposit{value: amount}();
        ghostDeposited += amount;
    }
}
```

You point the invariant suite at the handler, and now the random sequences are sequences of *valid-ish* operations, which is where real protocols actually break.

## The rule of thumb

Reach for fuzzing when the bug would be a bad input to one operation: an overflow, a boundary, a precision error. Reach for invariant testing when the bug would be a bad *interaction* between operations: a drained vault after a specific call ordering, accounting that drifts over a history.

Most serious protocol bugs are interaction bugs, which is why invariant testing earns its keep. But it costs more to set up (the handler, the right invariant), so fuzzing is the cheaper first pass. Run both. Fuzz the functions, then constrain the system, and let Foundry try to violate the truth you said could never be violated.
