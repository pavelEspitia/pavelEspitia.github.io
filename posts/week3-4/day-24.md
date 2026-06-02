---
title: "Auditing a Contract With No Source Code: Reading EVM Bytecode"
tags: ["web3","blockchain","security","ai"]
publish: false
---

You found a contract holding $4M. Etherscan shows the balance, the transactions, the token transfers. What it does not show is a single line of source code. The "Contract" tab just says: this contract has not been verified.

Now what? You can still audit it. The bytecode is right there on chain, fully public, and the EVM has no secrets from you. This post walks through reading deployed bytecode by hand, recovering function selectors, matching them against signature databases, and reconstructing a usable ABI with viem and whatsabi. By the end you will know exactly what you can recover and what is gone forever.

## Step 1: Fetch the Deployed Bytecode

Every deployed contract exposes its runtime bytecode through the `eth_getCode` RPC method. With viem, that is one call:

```typescript
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

const bytecode = await client.getCode({
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
});

console.log(bytecode);
// 0x608060405234801561001057600080fd5b50600436106103425760003560e01c...
```

If `getCode` returns `0x` (or `undefined`), the address is an externally owned account, not a contract, or the contract has self-destructed. Anything longer is runtime bytecode you can dissect.

Two things to know about this hex blob:

1. It is the **runtime** bytecode, not the **creation** bytecode. The creation code (the part that runs once during deployment and returns the runtime code) is only visible in the deployment transaction's `input` field, not from `eth_getCode`.
2. The compiler usually appends a metadata hash (CBOR-encoded, often an IPFS pointer to the source) at the very end. Sometimes that hash is enough to find the original source if the author published it elsewhere.

## Step 2: The Anatomy of Runtime Bytecode

EVM bytecode is a flat sequence of single-byte opcodes. Each opcode is one hex byte. `0x60` is `PUSH1`, `0x01` is `ADD`, `0x57` is `JUMPI`, and so on. The EVM reads them left to right and runs them on a stack machine.

The piece that matters for auditing is the part at the top of almost every compiled contract: the **function dispatcher**. When you call a contract, the first 4 bytes of your calldata are the function selector. The dispatcher reads those 4 bytes and jumps to the matching function body.

Here is the classic Solidity dispatcher prologue:

```
PUSH1 0x00       // 6000
CALLDATALOAD     // 35      load first 32 bytes of calldata
PUSH1 0xE0       // 60e0
SHR              // 1c      shift right 224 bits -> keep top 4 bytes
DUP1             // 80
PUSH4 0x18160ddd // 6318160ddd   selector for totalSupply()
EQ               // 14
PUSH2 0x0xxx     // 61....       jump destination
JUMPI            // 57      if equal, jump to totalSupply body
DUP1
PUSH4 0x70a08231 // 6370a08231   selector for balanceOf(address)
EQ
PUSH2 0x0xxx
JUMPI
...
```

That `CALLDATALOAD` / `PUSH1 0xE0` / `SHR` sequence is the fingerprint. It loads the calldata, shifts right by 224 bits (`0xE0` = 224) to isolate the leading 4 bytes, and then runs a chain of `PUSH4 <selector> / EQ / JUMPI` comparisons. Every `PUSH4` you see in that chain is a function selector the contract responds to.

## Step 3: What a Selector Actually Is

A function selector is the first 4 bytes of the keccak256 hash of the function's canonical signature. The canonical signature is the function name plus its argument types, no spaces, no parameter names:

```typescript
import { keccak256, toHex, toBytes } from "viem";

const signature = "transfer(address,uint256)";
const hash = keccak256(toBytes(signature));
const selector = hash.slice(0, 10); // "0x" + 8 hex chars = 4 bytes

console.log(selector); // 0xa9059cbb
```

`transfer(address,uint256)` always hashes to `0xa9059cbb` on every chain, in every contract, forever. That determinism is the whole reason bytecode auditing is even possible. The selectors are baked into the dispatcher, and they are reversible if (and only if) someone has already recorded the original signature.

This is also the catch. The hash is one way. Given `0xa9059cbb` you cannot compute `transfer(address,uint256)`. You can only look it up in a database of known signatures.

## Step 4: Recover the Selectors From Bytecode

You can extract candidate selectors by scanning the bytecode for the `PUSH4` opcode (`0x63`) followed by 4 bytes, in the region before the first `JUMPDEST` of the function bodies. A naive but surprisingly effective extractor:

```typescript
function extractSelectors(bytecode: string): string[] {
  const code = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;
  const selectors = new Set<string>();

  // walk the bytes, honoring PUSH data so we do not misread operands
  for (let i = 0; i < code.length; ) {
    const opcode = parseInt(code.slice(i, i + 2), 16);

    if (opcode === 0x63) {
      // PUSH4: the next 4 bytes are a candidate selector
      const data = code.slice(i + 2, i + 10);
      selectors.add("0x" + data);
      i += 10;
      continue;
    }

    // PUSH1 (0x60) through PUSH32 (0x7f) carry inline data we must skip
    if (opcode >= 0x60 && opcode <= 0x7f) {
      const dataLen = opcode - 0x5f; // 0x60 -> 1 byte, ... 0x7f -> 32
      i += 2 + dataLen * 2;
      continue;
    }

    i += 2;
  }

  return [...selectors];
}
```

The reason you must honor `PUSH` data lengths is that a `0x63` byte can appear *inside* the operand of some other `PUSH` instruction. If you scan blindly you get false selectors that were never meant to be opcodes. Skipping each push's payload keeps you aligned to real instruction boundaries.

Run it on USDC's bytecode and you get a clean list: `0x18160ddd`, `0x70a08231`, `0xa9059cbb`, `0x095ea7b3`, and so on. Those are real ERC-20 selectors.

## Step 5: Match Selectors Against a Signature Database

Now reverse the hash by lookup. Two public databases index millions of signatures:

| Source | Endpoint | Notes |
|--------|----------|-------|
| 4byte.directory | `https://www.4byte.directory/api/v1/signatures/` | Community-submitted, large, noisy (multiple collisions per selector) |
| OpenChain (ex-Sam Czsun) | `https://api.openchain.xyz/signature-database/v1/lookup` | Curated, also covers event topics |

A direct lookup against OpenChain:

```typescript
async function lookupSelector(selector: string): Promise<string[]> {
  const url = new URL("https://api.openchain.xyz/signature-database/v1/lookup");
  url.searchParams.set("function", selector);
  url.searchParams.set("filter", "true");

  const res = await fetch(url);
  const json = await res.json();
  const matches = json.result?.function?.[selector] ?? [];

  return matches.map((m: { name: string }) => m.name);
}

await lookupSelector("0xa9059cbb"); // ["transfer(address,uint256)"]
await lookupSelector("0x70a08231"); // ["balanceOf(address)"]
```

Be ready for collisions. Different signatures can hash to the same 4 bytes (4 bytes is only 32 bits of entropy). For `0x70a08231` you will almost always get `balanceOf(address)`, but obscure selectors can return several plausible names. You then disambiguate by how the function is used, what it returns, or which one is an ERC standard.

Selectors that return *nothing* are the interesting ones. They are custom functions whose signatures were never published. You know they exist, you know their 4-byte ID, but their name and argument types are unknown.

## Step 6: Let whatsabi Do the Heavy Lifting

Doing all of the above by hand is good for understanding. For real work, [whatsabi](https://github.com/shazow/whatsabi) does it properly, including proxy resolution and ABI assembly:

```typescript
import { whatsabi } from "@shazow/whatsabi";
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({ chain: mainnet, transport: http() });

const result = await whatsabi.autoload(
  "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI token
  {
    provider: client,
    // follows EIP-1967 / EIP-1822 proxies to the implementation
    followProxies: true,
    // resolve selectors via OpenChain + 4byte
    abiLoader: new whatsabi.loaders.MultiABILoader([
      new whatsabi.loaders.OpenChainABILoader(),
      new whatsabi.loaders.FourByteABILoader(),
    ]),
  },
);

console.log(result.abi);
// [
//   { type: "function", name: "transfer", inputs: [...], stateMutability: "nonpayable" },
//   { type: "function", selector: "0x...", inputs: [...] }, // unresolved: no name
//   ...
// ]
```

whatsabi reads the bytecode, extracts selectors the robust way, detects proxy patterns and follows them to the implementation contract, looks each selector up, and hands you an ABI you can pass straight into viem's `encodeFunctionData`. For resolved selectors you get real names and types. For unresolved ones you still get a usable entry keyed by selector, so you can call the function even without knowing what it is named.

## What You CAN and CANNOT Recover

This is the part people get wrong. Bytecode auditing is powerful but it is not decompilation back to source.

| Recoverable | Lost |
|-------------|------|
| Function selectors (all of them) | Parameter names (`to`, `amount`, ...) |
| Signatures for *published* functions | Signatures for custom/private functions |
| Argument types, often inferable | Local variable names, comments |
| Proxy implementation address | Original source structure, modifiers |
| Storage layout clues (slot access patterns) | Business logic intent |
| Events (topics are keccak of the event sig) | Internal/private function boundaries |

Three hard truths:

1. **Parameter names are gone.** The EVM never stored them. `transfer(address,uint256)` recovers, but whether the second arg was called `amount` or `value` is unknowable from bytecode.
2. **Unpublished selectors stay opaque.** If a contract has a function `secretMint(address,uint256)` that nobody ever recorded in 4byte or OpenChain, you get the selector and the calldata shape but never the name. You can still call it, you just do not know what it is for.
3. **The logic is still bytecode.** Recovering the ABI tells you the *interface*, not the *behavior*. To understand what `0x4a8c1fbb` actually does to storage you need a decompiler (like Dedaub or heimdall) or to read the opcodes by hand. The ABI gets you the front door, not a map of the building.

## Where This Goes

This whole pipeline (fetch bytecode, extract selectors, resolve signatures, follow proxies, assemble an ABI) is exactly what [AbiLens](https://github.com/pavelEspitia/abilens) runs every time you paste an unverified address. It tries Etherscan first for a verified ABI, and when that fails it falls back to whatsabi against the deployed bytecode, across 6 chains (Ethereum, Base, Arbitrum, Polygon, Optimism, Sepolia).

The payoff is that an unverified contract stops being a black box. AbiLens hands the reconstructed ABI to an LLM, so you can ask "what functions does this expose and which ones look like admin controls?" and get an answer grounded in the real selectors pulled out of the bytecode, even for the functions whose names came back generic.

## The Takeaway

A contract with no verified source is not a dead end. The bytecode is public, the dispatcher is a readable table of `PUSH4 <selector> / EQ / JUMPI`, and selectors are deterministic keccak256 hashes you can reverse through 4byte and OpenChain. With viem's `getCode` and whatsabi you go from a raw hex blob to a callable ABI in a few lines.

Just stay honest about the limits: you recover the interface, not the intent. Names, comments, and private logic do not survive compilation. For the rest, the bytecode tells you everything if you are willing to read it.

The pipeline is open source at [github.com/pavelEspitia/abilens](https://github.com/pavelEspitia/abilens).
