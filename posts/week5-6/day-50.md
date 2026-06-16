---
title: "Chatting With Any EVM Contract: How Scry Resolves Proxies and Unverified Bytecode"
tags: ["webdev", "blockchain", "typescript", "ai"]
publish: false
---

Scry lets you talk to any EVM smart contract in plain English. Point it at an address on six chains and ask "what does this do?" or "can I withdraw my funds?" The hard part is not the chat. It is getting a usable interface for a contract when the ABI is hidden behind a proxy, or when there is no verified source at all. Here is how the resolution pipeline works.

## The easy case, and why it is rare

If a contract is verified on a block explorer, you fetch its ABI and you are done. The ABI tells you every function, its inputs, and its outputs, and you can build a chat interface on top of it. With the unified Etherscan V2 API, one key covers all the chains Scry supports, which simplifies the fetch considerably.

The trouble is that "verified with a clean ABI" is the minority case for the contracts people actually want to inspect. Two things break it constantly: proxies and unverified bytecode.

## Problem 1: the proxy hides the real interface

Most serious protocols use upgradeable proxies. You query the address, the explorer hands you the *proxy's* ABI, and the proxy's ABI is almost empty: a fallback function and an upgrade mechanism. The functions you actually care about (transfer, withdraw, the protocol logic) live in the implementation contract, which sits at a different address.

So step one of resolution is detecting that you are looking at a proxy and following it to the implementation. The implementation address lives at a known storage slot for standard proxy patterns. For EIP-1967 proxies, it is a specific, deterministic slot:

```typescript
import { createPublicClient, http } from "viem";

// EIP-1967 implementation slot
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function resolveImplementation(client, proxyAddress: `0x${string}`) {
  const raw = await client.getStorageAt({ address: proxyAddress, slot: IMPL_SLOT });
  // The slot holds the implementation address, right-aligned in 32 bytes
  const impl = `0x${raw.slice(-40)}` as `0x${string}`;
  return impl === "0x0000000000000000000000000000000000000000" ? null : impl;
}
```

If the slot is non-zero, that is the implementation, and *that* is the address whose ABI you fetch. Scry follows the proxy automatically so the user does not have to know the contract is upgradeable. There are other proxy patterns (UUPS, beacon, transparent), so the resolver checks several known slots before giving up.

## Problem 2: no verified source at all

Sometimes there is no verified source anywhere: not on the proxy, not on the implementation. You have bytecode and nothing else. This is where most tools stop and where Scry uses bytecode reconstruction.

Even without source, the bytecode contains the function selectors: the first four bytes of the keccak hash of each function signature, which the contract uses to dispatch calls. A library like `whatsabi` scans the bytecode, extracts those selectors, and reconstructs a partial ABI:

```typescript
import { whatsabi } from "@shazow/whatsabi";

async function reconstructAbi(client, address: `0x${string}`) {
  const result = await whatsabi.autoload(address, {
    provider: client,
    // resolve selectors against a signature database to recover names
  });
  return result.abi;
}
```

The selectors are just four-byte hashes, so on their own they are opaque. But many of them are known: `0xa9059cbb` is `transfer(address,uint256)`. Resolving the selectors against a public signature database recovers human-readable names for the common ones, and the rest are presented as raw selectors the user can still call.

## Layering the resolution

Put together, the pipeline is a cascade, trying the richest source first:

1. Is it verified? Use the ABI. Done.
2. Is it a proxy? Resolve the implementation, then go back to step 1 for that address.
3. No verified source? Reconstruct the ABI from bytecode selectors.
4. Resolve selectors against a signature database for readable names.

Each step degrades gracefully into the next. The user gets the best interface available for that contract, and Scry never just throws up its hands because a contract is unverified.

## Where the LLM comes in

The resolved ABI is the interface; the LLM is the translator. With a function list in hand, the model maps the user's plain-English question ("can I get my money out?") to the relevant function (`withdraw`), explains what it does, and tells the user what they would need to call it. The ABI gives the model a precise, structured surface to reason about, which is far more reliable than asking it to guess about an address from raw bytecode.

That is the architecture: deterministic resolution to build the most complete interface possible, then the model on top to make it conversational. The intelligence is in the chat. The hard engineering is in never giving up on a contract just because someone forgot to verify it.
