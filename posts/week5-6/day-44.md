---
title: "Reading a Verified Contract You Didn't Write: A Systematic Approach"
tags: ["security", "blockchain", "solidity", "webdev"]
publish: false
---

Opening a 600-line Solidity contract you have never seen is intimidating. Where do you even start? Over time I developed a reading order that turns the wall of code into something I can reason about in an hour instead of a day. It is the same order whether I am auditing for vulnerabilities, integrating against the contract, or just trying to understand a protocol. Here it is.

## Don't read top to bottom

The instinct is to read the file from line 1. That is the worst approach, because the important parts (who can do what, where money moves) are scattered and the top is usually imports and boilerplate. You burn your attention before you reach anything that matters.

Read in order of *power*, not order of appearance.

## Step 1: find the money

Before anything else, I search for every place value moves:

```
transfer, transferFrom, send, call{value:, safeTransfer, mint, burn
```

These are the lines where the contract's assets change hands. Everything else exists to gate these. If I understand who can trigger each of these and under what conditions, I understand the contract's risk surface. So I list them first and treat them as the destinations I am working backward from.

## Step 2: map the access control

Next I find every modifier and every `require` that checks `msg.sender` or a role:

```
onlyOwner, onlyRole, require(msg.sender ==, hasRole, _checkOwner
```

I build a small mental (or literal) table: function, who can call it, what it does. The functions that move money and have weak or missing access control are the first thing I look at hard. This is where the access-control bugs live, the single most common cause of hacks.

```
setFeeRecipient   → anyone        → sets where fees go   ⚠️
withdrawFees      → feeRecipient  → drains fee balance
```

Two minutes of this table and a privilege-escalation path (anyone sets themselves as recipient, then withdraws) jumps out, where reading line by line you would never connect the two functions.

## Step 3: trace the state variables

Now I look at the storage: what state exists, and which functions write it. The dangerous pattern is a critical variable (a balance, an owner, a price) that more than one function can write, especially if one of those functions is less protected than the others. State that can be set from an unexpected path is where logic bugs hide.

For upgradeable contracts I also check the storage layout here, because a proxy that reorders variables corrupts state silently.

## Step 4: external calls and the reentrancy question

For every external call I found in step 1, I ask: does the contract update its state *before* or *after* the call? Checks-effects-interactions means state first, external call last. If a balance is decremented after a `.call`, that is a reentrancy flag. I also note any `delegatecall`, because that runs foreign code against this contract's storage and is a much sharper edge.

## Step 5: the math and the edges

Last, I look at the arithmetic. Division before multiplication (precision loss), decimal mismatches between tokens (USDC has 6, WETH has 18), array operations that could divide by zero on an empty array, and anything that assumes a value cannot be zero. These are quieter bugs but they are real, and they cluster in pricing and accounting code.

## Where AI fits in this flow

I do not hand the whole file to a model and say "find bugs." That produces a wall of maybe-findings with no priority. Instead I use the model to accelerate each step. After step 2, I ask it to "list every function that can move assets and the exact access control gating each one," which gives me the table faster than I can build it by hand. After step 4, I ask it to "trace each external call and report whether state is updated before or after it."

The structure comes from me. The model fills in the structure faster than I can. That division of labor is the whole point of AI-assisted auditing: it is a force multiplier on a method, not a replacement for having one.

## The payoff

This order works because it follows the actual risk. Money first (the targets), then access control (the gates), then state (the levers), then external calls (the escape hatches), then math (the quiet errors). By the time I have done steps 1 and 2, I usually already have a hypothesis about where the contract is weak, and steps 3 through 5 confirm or kill it.

A 600-line contract is not 600 lines of equal importance. Maybe 30 of them matter. The reading order is how you find those 30 fast.
