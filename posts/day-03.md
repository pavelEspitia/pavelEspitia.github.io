I Made a CLI That Talks to Any Smart Contract in Plain English

What if you could just *ask* a smart contract questions in plain English?

"What's the total supply?" → calls `totalSupply()` → "1,000,000 USDC"
"Who is the owner?" → calls `owner()` → "0x1234...abcd"
"How many holders are there?" → "This contract doesn't have a holder count function, but you could check Transfer events."

I built [AbiLens](https://github.com/pavelEspitia/abilens) — a chat interface for EVM smart contracts. Paste an address, pick a chain, start asking.

## How It Works

The architecture is simple — four steps:

### 1. Resolve the ABI

When you paste a contract address, AbiLens tries two approaches:

```
Etherscan API → verified ABI (best case)
        ↓ (if not verified)
whatsabi → reconstruct ABI from bytecode
```

[whatsabi](https://github.com/shazow/whatsabi) is the secret weapon here. It reads the deployed bytecode, detects function selectors, follows proxy patterns (EIP-1967), and looks up signatures in the 4byte directory. You get a usable ABI even for unverified contracts.

### 2. Build Context for the LLM

The system prompt tells the LLM what functions are available:

```
You are AbiLens. This contract is USDC at 0xA0b8...eB48 on Ethereum.

Available read functions:
  name() → string
  symbol() → string
  decimals() → uint8
  totalSupply() → uint256
  balanceOf(address account) → uint256
  allowance(address owner, address spender) → uint256
```

The LLM now knows exactly what it can call.

### 3. LLM Decides What to Call

When you ask "what's the total supply?", the LLM responds with:

```json
{"calls": [{"functionName": "totalSupply", "args": []}]}
```

AbiLens executes the call using viem:

```typescript
const result = await client.call({
  to: contractAddress,
  data: encodeFunctionData({ abi, functionName: "totalSupply", args: [] }),
});
```

### 4. LLM Explains the Result

The raw result goes back to the LLM: `totalSupply() = 43941622816877670`. The LLM knows USDC has 6 decimals (it checked `decimals()` first) and responds:

"The total supply of USDC is approximately 43.94 billion tokens."

## Supported Chains

AbiLens works with any EVM chain. Currently configured:

- Ethereum
- Base
- Arbitrum
- Polygon
- Optimism
- Sepolia (testnet)

Adding a new chain is one object in the config.

## Unverified Contracts

This is where AbiLens gets interesting. Most tools require a verified ABI from Etherscan. AbiLens doesn't.

For unverified contracts, whatsabi reconstructs an approximate ABI. The function names might be generic (`function_0x1a2b3c`), but the types are correct. The LLM adapts:

"This contract has an unverified ABI. I can see a function at selector 0x1a2b3c4d that takes an address and returns a uint256 — this is likely a balance lookup."

## The Stack

- **viem** — EVM interaction (lighter than ethers.js, fully typed)
- **whatsabi** — ABI reconstruction from bytecode
- **Next.js 15** — Web UI with App Router
- **Claude / Ollama** — LLM provider (works with both)

## Try It

```bash
git clone https://github.com/pavelEspitia/abilens
cd abilens
cp .env.example .env
# Add your ETHERSCAN_API_KEY to .env
pnpm install && pnpm dev
```

Paste the USDC address: `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`

Ask: "What is this contract and what can I do with it?"

## What's Next

- Write support (with wallet connection)
- Event log querying ("show me the last 10 transfers")
- Multi-contract conversations ("compare the TVL of these two pools")

The code is open source at [github.com/pavelEspitia/abilens](https://github.com/pavelEspitia/abilens).
