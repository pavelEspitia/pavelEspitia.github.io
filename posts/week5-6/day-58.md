---
title: "Gas Optimization That Doesn't Break Security: Storage, Calldata, and the Traps"
tags: ["blockchain", "solidity", "security", "tutorial"]
publish: false
---

Gas optimization is satisfying. You shave a few thousand gas off a function and feel clever. But some optimizations trade away safety in ways that are not obvious, and I have seen "optimized" contracts that introduced vulnerabilities. Here are the gas wins that are genuinely free, the ones that cost you safety, and how to tell the difference.

## Where gas actually goes

Before optimizing, know what is expensive. Storage operations dominate. Writing a fresh storage slot (`SSTORE` from zero to non-zero) costs a lot; reading storage (`SLOAD`) is cheaper but still meaningful; computation in memory is cheap by comparison. So the highest-leverage optimizations are about touching storage less.

## Free win 1: cache storage reads in memory

If you read the same storage variable multiple times in a function, each read is an `SLOAD`. Read it once into a local variable instead:

```solidity
// WASTEFUL: reads storage `total` three times
function distribute() external {
    require(total > 0, "empty");
    uint256 share = total / count;
    emit Distributed(total);
}

// OPTIMIZED: one SLOAD, two memory reads
function distribute() external {
    uint256 _total = total;        // single storage read
    require(_total > 0, "empty");
    uint256 share = _total / count;
    emit Distributed(_total);
}
```

This is free in the sense that it changes nothing about correctness. The value is identical; you just read it once. Pure win.

## Free win 2: calldata instead of memory for read-only arrays

For external function arguments you only read (never modify), `calldata` is cheaper than `memory` because it skips the copy:

```solidity
// memory copies the whole array into memory
function process(uint256[] memory ids) external { ... }
// calldata reads directly from the transaction data, no copy
function process(uint256[] calldata ids) external { ... }
```

Again, free. If you do not mutate the array, `calldata` is strictly better.

## Free win 3: storage packing

Solidity packs multiple variables into one 32-byte slot if they fit and are adjacent. Order your storage variables so small types sit together:

```solidity
// WASTEFUL: each takes a full slot due to ordering
uint256 a;   // slot 0
bool flag;   // slot 1 (wastes 31 bytes)
uint256 b;   // slot 2
address addr;// slot 3 (wastes 12 bytes)

// PACKED: bool and address share a slot
uint256 a;   // slot 0
uint256 b;   // slot 1
address addr;// slot 2 (20 bytes)
bool flag;   // slot 2 (1 byte, packed with addr)
```

Free, with one caveat for upgradeable contracts: reordering storage is exactly what causes storage-collision bugs on upgrade. So pack from the start on a new contract, but never reorder an already-deployed one to save gas.

## The traps: optimizations that cost you safety

**Trap 1: removing checks to save gas.** I have seen people delete a `require` because it costs gas. The check was the security. A zero-address check, a bounds check, an overflow guard: these cost a little gas and prevent a lot of pain. Never optimize away a check whose job is to stop a bad state.

**Trap 2: `unchecked` blocks without proof.** Solidity 0.8+ adds automatic overflow checks, which cost gas. You can opt out with `unchecked { }`, and it is a legitimate optimization *when you have proven the math cannot overflow*. The trap is using it because it is faster, on math you have not proven safe:

```solidity
// SAFE use: i can't overflow because the loop bounds it
for (uint256 i = 0; i < len;) {
    // ... work ...
    unchecked { ++i; }   // i < len, proven not to overflow
}

// DANGEROUS use: amount comes from the caller, could overflow
unchecked {
    balance += amount;   // if this overflows, the balance wraps. Bug.
}
```

The rule: `unchecked` is only safe when you can write down *why* the value cannot exceed the type's range. "It is faster" is not that reason.

**Trap 3: assembly for micro-optimizations.** Inline assembly can save gas, but it bypasses every safety check Solidity gives you: bounds, overflow, type safety. A small gas saving in an assembly block is rarely worth the risk that you got the raw memory math subtly wrong. I treat assembly as a last resort, used only where profiling proves it matters and reviewed twice as hard.

## How I think about the tradeoff

The free wins (caching reads, calldata, packing on new contracts) are pure improvements with no safety cost. Take all of them. The trapped wins (removing checks, blind `unchecked`, casual assembly) trade safety for gas, and in smart contracts that trade is almost always bad, because the cost of a bug is the whole contract balance and the cost of the gas is pennies.

The question for any optimization: *does this change what the contract guarantees?* If it only changes how cheaply it computes the same guaranteed result, it is safe. If it weakens a guarantee, the gas saving is not worth it. Optimize the computation, never the safety.
