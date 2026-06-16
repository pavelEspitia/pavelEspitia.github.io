---
title: "Proxy Contracts and Storage Collisions: The Upgrade That Corrupts Your State"
tags: ["security", "blockchain", "solidity", "tutorial"]
publish: false
---

Upgradeable contracts are everywhere in DeFi, and they hide a category of bug that has nothing to do with the logic you wrote and everything to do with where Solidity puts your variables. Storage collisions corrupt state silently: no revert, no error, just a balance that is suddenly an address or an owner that is suddenly a number. Here is how proxies store data, how collisions happen, and how to avoid them.

## How a proxy works in 30 seconds

An upgradeable contract is actually two contracts. The proxy holds the *state* (the storage) and the address of the *implementation*. When you call the proxy, it `delegatecall`s into the implementation. The implementation's code runs, but it runs against the *proxy's* storage.

That last part is the whole source of the danger. The logic contract's code reads and writes storage slots, but those slots belong to the proxy. So the proxy and every implementation must agree, exactly, on what lives in each storage slot.

## Where Solidity puts variables

Solidity assigns state variables to storage slots in declaration order, starting at slot 0:

```solidity
contract V1 {
    address public owner;    // slot 0
    uint256 public total;    // slot 1
    mapping(address => uint256) public balances; // slot 2
}
```

`owner` is slot 0, `total` is slot 1, and so on. The implementation reads slot 0 expecting an address. As long as that is true, everything works.

## The collision: reordering on upgrade

Now you ship V2 and, innocently, reorder the variables or insert a new one at the top:

```solidity
contract V2 {
    uint256 public total;    // slot 0  ← was address owner!
    address public owner;    // slot 1  ← was uint256 total!
    mapping(address => uint256) public balances; // slot 2
}
```

You did not change the proxy's storage. The proxy still has the old `owner` address sitting in slot 0. But V2's code now reads slot 0 as `total`, a `uint256`. So `total` is now the numeric value of the old owner's address, and `owner` is whatever number used to be `total`.

No revert. The contract runs. It is just operating on garbage. An attacker who notices can often exploit the corrupted `owner` slot to take control.

## The rules that prevent it

The fix is discipline about storage layout across versions:

- **Never reorder existing variables.** Their slots are fixed forever once deployed.
- **Never change a variable's type** in a way that changes its slot size.
- **Only append new variables** at the end, after all existing ones.
- **Never remove a variable.** Leave it (you can rename it to `deprecated_x` for clarity), or its slot gets reused by the next variable and you have a collision.

```solidity
contract V2 {
    address public owner;    // slot 0, unchanged
    uint256 public total;    // slot 1, unchanged
    mapping(address => uint256) public balances; // slot 2, unchanged
    uint256 public feeRate;  // slot 3, NEW, appended at the end. Safe.
}
```

## Storage gaps and namespaced storage

Two patterns make this safer. The older one is a storage gap: reserve empty slots in a base contract so child contracts have room to add variables without colliding with the next contract in the inheritance chain:

```solidity
contract Base {
    address public owner;
    uint256[49] private __gap; // reserved slots for future variables
}
```

The modern one, ERC-7201 namespaced storage, sidesteps the problem by putting each module's storage at a hashed, collision-resistant slot rather than packing everything from slot 0. If you are starting a new upgradeable contract in 2026, prefer namespaced storage; it makes whole classes of collision structurally impossible.

## How I check for it in an audit

When I review an upgradeable contract, the implementation logic is only half the job. The other half is comparing the storage layout of the new version against the deployed one. Foundry and Hardhat both have tooling that dumps the storage layout:

```bash
forge inspect V2 storageLayout
```

I diff that against V1's layout and look for any variable whose slot changed. A changed slot for an existing variable is a collision, full stop. The check is mechanical, which is exactly why it gets skipped under deadline pressure, and exactly why it bites.

The unsettling part of storage collisions is that your code can be perfect and your upgrade still corrupts everything, because the bug is in the layout, not the logic. Treat the storage layout as a contract in its own right: append-only, never reordered, diffed on every upgrade. The compiler will not warn you. You have to look.
