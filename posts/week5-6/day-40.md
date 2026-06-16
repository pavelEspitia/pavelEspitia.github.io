---
title: "Oracle Manipulation: How a $392K Silo Finance Loss Happened in 2026"
tags: ["security", "blockchain", "solidity", "ai"]
publish: false
---

While the nine-figure hacks of 2026 grabbed headlines, the smaller ones are more instructive because they are the bugs you and I might actually write. On April 3, 2026, lending protocol Silo Finance lost about $392,000 to a misconfigured oracle. No exotic attack. A price feed that lied, and a contract that believed it. Here is how oracle manipulation works and why it keeps draining protocols.

## The shape of every oracle bug

A lending protocol needs to know what your collateral is worth. It asks an oracle. If the oracle can be fooled, the protocol can be fooled: borrow against collateral that is suddenly "worth" far more than it is, or get liquidated when it is suddenly "worth" far less.

Every oracle exploit reduces to the same question: can the attacker move the number the contract trusts, cheaply enough that the manipulation costs less than the profit?

## The classic mistake: pricing off a spot DEX pool

The most common version reads the price directly from an AMM pool's reserves:

```solidity
function getPrice() public view returns (uint256) {
    (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
    return (reserve1 * 1e18) / reserve0; // spot price, right now
}
```

This is the spot price at this instant. An attacker with a flash loan can swap a huge amount into the pool, move the reserves, call the function that reads this price, and unwind, all in one transaction. For the duration of that transaction the price is whatever they pushed it to. They borrow against the inflated value and walk away.

The cost is the swap fees and the flash loan fee. The profit is the over-borrowed amount. When the pool is shallow, the cost is tiny.

## Why TWAP helps and where it does not

The standard defense is a time-weighted average price. Instead of the instant reserves, you read the price averaged over a window:

```solidity
// Uniswap V3 style: average tick over `secondsAgo`
function getTwap(uint32 secondsAgo) public view returns (uint256) {
    uint32[] memory secondsAgos = new uint32[](2);
    secondsAgos[0] = secondsAgo;
    secondsAgos[1] = 0;
    (int56[] memory tickCumulatives, ) = pool.observe(secondsAgos);
    int24 avgTick = int24((tickCumulatives[1] - tickCumulatives[0]) / int56(uint56(secondsAgo)));
    return tickToPrice(avgTick);
}
```

A flash loan cannot move a multi-minute average in one transaction, because the average includes blocks the attacker does not control. That kills the single-transaction flash-loan version.

But TWAP is not a magic word. Two things still bite:

- **A short window.** A 30-second TWAP on a shallow pool can still be moved by an attacker willing to hold the position across a couple of blocks. Longer windows are safer but lag real price, which creates its own risk during fast moves.
- **A thin pool.** TWAP averages the manipulation; it does not prevent it. On a low-liquidity pair, sustained manipulation across the window is affordable.

## What "misconfigured" usually means

When a post-mortem says "misconfigured oracle," it is rarely that the team did not know what an oracle is. It is usually one of these:

- They used a robust oracle (like Chainlink) for the main asset but a spot DEX price for a newer or thinner asset, and the attacker hit the weak one.
- They set a TWAP window too short for the pool's liquidity.
- They did not validate the oracle's freshness, so a stale price from a paused or laggy feed was treated as current.

The freshness check is the one people forget:

```solidity
(, int256 price, , uint256 updatedAt, ) = priceFeed.latestRoundData();
require(price > 0, "bad price");
require(block.timestamp - updatedAt < MAX_STALENESS, "stale price"); // often missing
```

## How I audit for this

When I review a protocol that prices assets, I trace every price read back to its source and ask three things:

1. **Can a single transaction move this number?** If it reads spot reserves, yes. Flag it.
2. **Is the averaging window appropriate for the pool's depth?** A 30-second TWAP on a $50K pool is not safe.
3. **Is staleness checked?** If the code trusts a feed without checking `updatedAt`, a paused feed becomes an attack.

This is a place where AI-assisted review genuinely helps, because the vulnerability spans multiple functions and requires reasoning about economics, not just syntax. The prompt I use asks the model to "trace each price source, determine whether it is manipulable within one transaction or one block, and estimate the cost of manipulation relative to the protocol's borrow limits." That economic framing is what separates "I see a `getReserves` call" from "this $50K pool gates a $1M borrow cap, which is exploitable."

The Silo loss was small by 2026 standards, but the lesson scales: the protocol is only as honest as the cheapest number it trusts. Find the cheapest number, and you have found the bug.
