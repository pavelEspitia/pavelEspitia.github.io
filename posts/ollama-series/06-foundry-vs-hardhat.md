---
title: "Foundry vs Hardhat in 2026: Which Solidity Toolchain Wins?"
tags: ["solidity", "web3", "ethereum", "tutorial"]
publish: true
---

# Foundry vs Hardhat in 2026: Which Solidity Toolchain Wins?

Two toolchains. Same goal: write, test, and deploy Solidity. Different design philosophies, very different best-fits in 2026.

I've used both in production across smart-contract audits and protocol work over the last two years. Here's an honest comparison so you don't waste a week picking the wrong default for your team.

## TL;DR

- **Foundry** — best for security work, audits, protocol engineering, and anyone who values speed and Solidity-native tests. The default for serious DeFi.
- **Hardhat 3** — best when your contracts are tightly coupled to a TypeScript frontend or backend, when your team already lives in Node.js, or when you depend on plugins that haven't migrated.
- **Both at once** — legitimate, common, not a smell. Many teams write tests in Foundry and deployments in Hardhat.

If you're starting a new protocol from scratch in 2026, default to **Foundry**. The rest of this post explains when the others are correct.

## Installation and first impressions

### Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge init my-project
```

Three commands. Sub-30 seconds. You get `forge` (compiler / test runner), `cast` (CLI for chain interaction), and `anvil` (local node). All written in Rust. All single binaries. No package.json, no node_modules.

### Hardhat 3

```bash
mkdir my-project && cd my-project
pnpm init
pnpm add -D hardhat
npx hardhat --init
```

Hardhat 3 (released late 2025) is a substantial rewrite. The new toolchain runs on a Rust-based execution layer (effectively REVM), bringing the test speed within striking distance of Foundry. It also natively supports Solidity tests, which were exclusive to Foundry until last year.

This matters: most "Foundry vs Hardhat" comparisons online are pre-Hardhat-3 and outdated.

## Test speed (the headline metric)

Same Uniswap-V2-style contract, 80 unit tests, on an M2 MacBook:

| Toolchain | Cold run | Warm run | Memory |
|---|---|---|---|
| Foundry | 1.3 s | 0.4 s | 220 MB |
| Hardhat 3 (Solidity tests) | 2.1 s | 0.7 s | 480 MB |
| Hardhat 2 (TypeScript tests via ethers) | 18 s | 9 s | 1.2 GB |

Hardhat 3 closed the gap. It's now within 2x of Foundry on equivalent test suites — versus the 10-20x penalty Hardhat 2 incurred. If your only reason for picking Foundry was speed, that argument is weaker in 2026.

## Test ergonomics

### Foundry — Solidity tests

```solidity
// test/Counter.t.sol
pragma solidity ^0.8.20;
import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterTest is Test {
    Counter c;

    function setUp() public {
        c = new Counter();
    }

    function test_increment() public {
        c.increment();
        assertEq(c.count(), 1);
    }

    function testFuzz_setNumber(uint256 x) public {
        c.setNumber(x);
        assertEq(c.count(), x);
    }
}
```

Tests live in the same language as the contracts. No type marshaling. No JS context switch. Fuzzing is a built-in keyword (`testFuzz_`) — no extra config.

### Hardhat 3 — same test, two flavours

```solidity
// test/Counter.t.sol — Solidity test
import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterTest is Test {
    Counter c;
    function setUp() public { c = new Counter(); }
    function test_increment() public { c.increment(); assertEq(c.count(), 1); }
}
```

Hardhat 3 runs Foundry-compatible tests. Identical syntax. Either toolchain executes them.

```typescript
// test/Counter.ts — TypeScript test (still supported)
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Counter", () => {
  it("increments", async () => {
    const Counter = await ethers.getContractFactory("Counter");
    const c = await Counter.deploy();
    await c.increment();
    expect(await c.count()).to.equal(1);
  });
});
```

The TS path is for teams that want to integrate tests with frontend assertions or backend test suites. Slower to run, but the unified language can pay off in a full-stack codebase.

## Plugin and ecosystem

| | Foundry | Hardhat |
|---|---|---|
| Coverage | `forge coverage` (built-in) | `solidity-coverage` plugin |
| Verification | `forge verify-contract` | `hardhat-verify` plugin |
| Local node | `anvil` (built-in) | `hardhat-node` (built-in) |
| Mainnet forking | `forge --fork-url` (built-in) | `hardhat-network --fork` (built-in) |
| Contract upgrades | Manual proxies | `@openzeppelin/hardhat-upgrades` |
| Gas reports | `forge test --gas-report` | `hardhat-gas-reporter` plugin |
| Defender / monitoring | Manual scripting | `defender-cli` integration |
| Frontend type generation | None native (use `wagmi-cli` separately) | `typechain` (mature plugin) |

Hardhat's plugin ecosystem is wider and more mature — particularly for OpenZeppelin upgrades and frontend integration. Foundry trades plugin breadth for built-in primitives that cover 80% of needs without extension.

## Where each one wins

### Use Foundry if

- You're building a DeFi protocol, lending market, AMM, vault, or anything where a missed bug equals a wallet drain.
- Your team's primary language is Solidity, not TypeScript.
- You need fast invariant testing or stateful fuzzing as part of CI.
- You write audits or work in security-adjacent roles. Auditors expect Foundry projects.
- You don't want a node_modules graph.

### Use Hardhat 3 if

- Your contracts are part of a full-stack TypeScript app and your team lives in `pnpm` workspaces.
- You depend on OpenZeppelin's upgrade plugin or other Hardhat-only tooling.
- Your team has invested in TypeScript test patterns and the migration cost is high.
- You ship to many networks with environment-specific deployment scripts and want the JS flexibility.

### Use both (the senior move)

The pattern many serious teams adopt:

- **Tests in Foundry.** Speed, fuzzing, invariant testing, Solidity-native ergonomics.
- **Deployments in Hardhat.** Network-specific configs, OpenZeppelin upgrade plugin, TypeScript scripting.

This is supported by Hardhat 3 out of the box — it can read Foundry's `foundry.toml`, share build artifacts, and run mixed test suites. The boundaries between the two have softened significantly.

## What changed in 2026

If you read a "Foundry vs Hardhat" post from 2024, it's probably out of date in three places:

1. **Hardhat 3's Rust execution layer** closed most of the speed gap.
2. **Solidity tests in Hardhat** removed the "Foundry is the only Solidity-native option" advantage.
3. **Cross-tool interop** — `foundry.toml` parsed by Hardhat, shared artifacts — turned the "pick one" decision into "pick which side of the workflow each tool handles."

The decision is no longer binary. It's about workflow phase.

## My recommendation

Start with Foundry. It's the right default for the security-sensitive work that pays $10K+ a month. If your project grows into a full-stack codebase that needs Hardhat's plugin ecosystem, layer Hardhat 3 on top — they coexist cleanly.

The wrong move is picking Hardhat in 2026 because that's what 2022 tutorials taught, and then six months later trying to retrofit Foundry-level test speed into a deeply Hardhat-coupled codebase.

Pick the tool that matches the work you'll be doing in twelve months. For most protocol engineers in 2026, that's Foundry first.

Next post in the series: how to set up a CI pipeline for a Foundry project that runs invariant tests, gas reports, and coverage — under 50 lines of YAML.
