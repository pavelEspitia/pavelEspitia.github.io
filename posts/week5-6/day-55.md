---
title: "Front-Running and MEV: Writing Contracts That Don't Leak Money to the Mempool"
tags: ["security", "blockchain", "solidity", "tutorial"]
publish: false
---

When you submit a transaction, it sits in the public mempool before it is mined, visible to everyone. Bots watch that mempool and reorder, insert, or sandwich transactions to extract value. This is MEV, and if you write a contract without thinking about it, you are leaving money on the table for bots to take, and sometimes leaking it from your users. Here is how front-running works and how to design around it.

## The mempool is public, and that is the whole problem

Your pending transaction is not secret. Between submission and inclusion, anyone can see exactly what you are about to do: the function, the parameters, the amounts. Bots run sophisticated strategies on this visibility. The three you most need to understand:

- **Front-running**: a bot sees your profitable transaction and submits the same one with a higher gas price so it executes first and takes the profit.
- **Sandwiching**: a bot places one transaction right before yours and one right after, profiting from the price impact your transaction creates.
- **Back-running**: a bot submits immediately after yours to capture an arbitrage your transaction opened up.

The common thread: the value leaks because the *intent* of your transaction was visible before it executed.

## Where contracts leak: the classic cases

**A swap with no slippage protection.** You call a DEX swap. A bot sandwiches it: buys before you (pushing the price up), lets your swap execute at the worse price, then sells after. You get fewer tokens than expected, and the difference is the bot's profit.

```solidity
// LEAKS: no minimum-output protection, fully sandwichable
function swap(uint256 amountIn) external {
    uint256 out = pool.swap(amountIn); // takes whatever price the pool gives
    token.transfer(msg.sender, out);
}
```

The fix is a user-supplied minimum output. The transaction reverts rather than executing at a manipulated price:

```solidity
// PROTECTED: revert if the sandwich pushed output below the user's floor
function swap(uint256 amountIn, uint256 minOut, uint256 deadline) external {
    require(block.timestamp <= deadline, "expired");
    uint256 out = pool.swap(amountIn);
    require(out >= minOut, "slippage");   // bot's sandwich makes this revert
    token.transfer(msg.sender, out);
}
```

The `minOut` turns "I will take any price" into "I will take a price at least this good or nothing." A sandwich that pushes the price past the floor now just causes a revert, which makes the attack unprofitable. The `deadline` stops a transaction from sitting in the mempool and being executed later at a bad moment.

**A "first to claim wins" pattern.** Any function where being first matters (claiming a reward, minting a limited item, liquidating a position) is a front-running target. A bot sees your claim transaction and submits its own with higher gas to win the race. There is no clean contract-only fix for the race itself; the design lever is to not make naive first-come-first-served the mechanism. Commit-reveal and batch auctions exist precisely because "fastest transaction wins" leaks to whoever pays the most gas, which is the bots.

## Commit-reveal: hide the intent until it is too late to front-run

When the value leak comes from intent being visible, the structural fix is to not reveal the intent in the front-runnable transaction. Commit-reveal splits an action into two phases:

1. **Commit**: submit a hash of your intended action plus a secret. The hash reveals nothing.
2. **Reveal**: in a later transaction, reveal the action and the secret. The contract checks it matches the committed hash.

```solidity
mapping(address => bytes32) public commitments;

function commit(bytes32 hash) external {
    commitments[msg.sender] = hash; // e.g. keccak256(abi.encode(choice, secret))
}

function reveal(uint256 choice, bytes32 secret) external {
    require(commitments[msg.sender] == keccak256(abi.encode(choice, secret)), "bad reveal");
    delete commitments[msg.sender];
    // act on `choice`. front-runners couldn't see it during the commit phase
}
```

By the time the choice is public (at reveal), the commit window is closed and front-running it is pointless. This is the standard defense for auctions, votes, and anything where knowing your move early lets someone beat you to it.

## What contracts cannot fix, and where the ecosystem helps

Some MEV is not solvable at the contract level. A determined searcher with a private relationship to block builders has advantages no `require` can erase. The ecosystem answer is private transaction relays (private mempools) that keep your transaction out of the public mempool until it is included, so bots never see it pending. As a contract author you cannot force users onto those, but you can design so that a user who *does* use one is fully protected, and a user who does not at least has slippage and deadline floors.

## The design mindset

The question to ask for every state-changing function: *if a bot could see this transaction before it executed, could it profit at my user's expense?* If yes, you need a defense. Slippage and deadline parameters for price-sensitive operations. Commit-reveal for intent-sensitive ones. And an honest acknowledgment that the public mempool is an adversarial environment where your transaction's intent is a signal others trade on. Design like the mempool is watching, because it is.
