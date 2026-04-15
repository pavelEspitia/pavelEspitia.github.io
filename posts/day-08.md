What Happens When You Call a Smart Contract? A Visual Guide

Every interaction with a smart contract — checking a token balance, swapping on Uniswap, minting an NFT — follows the same fundamental path. Understanding that path turns blockchain development from "it works but I don't know why" into "I know exactly what's happening at every step."

Let's trace a contract call from your browser all the way to the EVM and back.

## The Journey of a Contract Call

Here's the high-level flow:

```
Your App → JSON-RPC Request → RPC Node → EVM Execution → State Change → Response
```

Let's break down each step.

## Step 1: ABI Encoding

Your application doesn't send human-readable function calls to the blockchain. It sends raw bytes. The ABI (Application Binary Interface) defines how to encode function names and parameters into those bytes.

A function call is encoded as:
- **4 bytes**: the function selector (first 4 bytes of the keccak256 hash of the function signature)
- **32 bytes per parameter**: each argument padded to 32 bytes

For example, calling `transfer(address to, uint256 amount)` with address `0xAbC...123` and amount `1000000`:

```
Function signature: "transfer(address,uint256)"
Keccak256 hash:     0xa9059cbb2ab09eb219583f4a59a5d0623ade346d962bcd4e46b11da047c9049b
Function selector:  0xa9059cbb (first 4 bytes)
```

The final calldata is the selector followed by the ABI-encoded parameters — the address padded to 32 bytes and the amount padded to 32 bytes.

Using viem, you don't do this manually:

```typescript
import {
  encodeFunctionData,
  parseAbi,
} from "viem";

const abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

const data = encodeFunctionData({
  abi,
  functionName: "transfer",
  args: [
    "0xAbCdEf0123456789AbCdEf0123456789AbCdEf01",
    1000000n,
  ],
});

// data = "0xa9059cbb000000000000000000000000abcdef..."
```

The `encodeFunctionData` function takes the ABI, function name, and arguments, and returns the hex-encoded calldata. This is what actually gets sent to the network.

## Step 2: The JSON-RPC Request

Your app sends the encoded data to an RPC node (Infura, Alchemy, or your own node) via a JSON-RPC call. For a read-only call:

```json
{
  "jsonrpc": "2.0",
  "method": "eth_call",
  "params": [
    {
      "to": "0xContractAddress...",
      "data": "0xa9059cbb000000000000..."
    },
    "latest"
  ],
  "id": 1
}
```

For a state-changing call (a transaction), the method is `eth_sendRawTransaction` and the params include a signed transaction with gas, nonce, and value fields.

This distinction matters: `eth_call` is free and instant. `eth_sendRawTransaction` costs gas and waits for block inclusion.

## Step 3: View Calls vs. Write Calls

This is the most important distinction in smart contract development.

**View calls** (`eth_call`) execute the contract code on the RPC node without creating a transaction. They read state but don't change it. They're free, instant, and don't need a wallet signature.

```typescript
import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
});

// View call — free, instant, no signature needed
const balance = await client.readContract({
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  abi: parseAbi([
    "function balanceOf(address) view returns (uint256)",
  ]),
  functionName: "balanceOf",
  args: ["0xYourAddress..."],
});
```

**Write calls** (`eth_sendRawTransaction`) create a transaction that gets included in a block. They can change contract state — update balances, transfer tokens, modify mappings. They cost gas and require the sender's signature.

```typescript
import { createWalletClient, custom } from "viem";

const walletClient = createWalletClient({
  chain: mainnet,
  transport: custom(window.ethereum),
});

// Write call — costs gas, needs signature, waits for block
const hash = await walletClient.writeContract({
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  abi: parseAbi([
    "function transfer(address, uint256) returns (bool)",
  ]),
  functionName: "transfer",
  args: ["0xRecipient...", 1000000n],
});
```

In Solidity, `view` and `pure` functions are view calls. Everything else is a write call.

## Step 4: EVM Execution

When the RPC node receives the call, it feeds the calldata to the Ethereum Virtual Machine. The EVM:

1. Loads the contract's bytecode from the target address
2. Reads the function selector (first 4 bytes of calldata)
3. Jumps to the corresponding function in the bytecode
4. Executes opcodes one by one, consuming gas for each
5. Reads from and writes to the contract's storage slots
6. Returns the result or reverts with an error

Each operation costs gas. Storage writes (`SSTORE`) are the most expensive at 20,000 gas for a new slot. Storage reads (`SLOAD`) cost 2,100 gas. Simple arithmetic (`ADD`, `MUL`) costs 3-5 gas. This is why optimizing storage access matters in smart contracts.

## Step 5: Decoding the Response

The EVM returns raw bytes. Your application needs to decode them back into usable values using the ABI.

```typescript
import { decodeFunctionResult, parseAbi } from "viem";

const abi = parseAbi([
  "function balanceOf(address) view returns (uint256)",
]);

// Raw hex response from eth_call
const rawResult =
  "0x00000000000000000000000000000000000000000000000000000000000f4240";

const balance = decodeFunctionResult({
  abi,
  functionName: "balanceOf",
  data: rawResult,
});

// balance = 1000000n (BigInt)
```

The response `0x...0f4240` is the hex representation of 1,000,000 padded to 32 bytes. `decodeFunctionResult` reads the ABI to know the return type is `uint256` and decodes accordingly.

In practice, viem's `readContract` handles both encoding and decoding — you pass in typed arguments and get back typed results. But understanding the underlying encoding helps you debug when things go wrong.

## Function Selectors: Why 4 Bytes Matter

The function selector is the keccak256 hash of the function signature, truncated to 4 bytes. This means different functions can have the same selector if their signature hashes collide in the first 4 bytes. It's rare but it happens.

You can compute selectors yourself:

```typescript
import { keccak256, toBytes, slice } from "viem";

const signature = "transfer(address,uint256)";
const hash = keccak256(toBytes(signature));
const selector = slice(hash, 0, 4);
// selector = "0xa9059cbb"
```

Tools like AbiLens use function selectors to identify what a transaction is doing. When you see calldata starting with `0xa9059cbb`, you know it's an ERC-20 transfer — even without the contract's source code.

This is also how proxy contracts work. The proxy receives the calldata, sees the function selector, and delegates the call to an implementation contract. The selector is the routing mechanism.

## The Complete Picture

Putting it all together for a token balance check:

1. Your app calls `readContract({ functionName: "balanceOf", args: [address] })`
2. Viem encodes this as `0x70a08231` + the address padded to 32 bytes
3. Viem sends an `eth_call` JSON-RPC request to your configured RPC node
4. The RPC node executes the contract bytecode in the EVM
5. The EVM reads the balance from storage slot and returns the raw bytes
6. Viem decodes the raw bytes back into a `BigInt`
7. Your app displays "1,000,000 USDC"

Every dapp interaction — from checking balances to swapping tokens to voting in a DAO — follows this same flow. The functions change, the parameters change, but the encoding, transport, execution, and decoding steps are always the same.

Understanding this pipeline is what separates copying tutorial code from building contracts and dapps with confidence. When a transaction reverts, you'll know to check the calldata encoding. When gas estimates are high, you'll know to look at storage operations. When a function returns unexpected data, you'll know to verify the ABI matches the deployed contract.
