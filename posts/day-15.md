What I Learned Building 2 AI Products in 2 Weeks

Two weeks ago, spectr-ai and AbiLens didn't exist. Today, spectr-ai is a working AI smart contract auditor with a CLI engine and a Next.js web interface. AbiLens lets you chat with any deployed EVM smart contract by address. Both use multiple LLM providers, both have test suites, and both solve real problems I actually had.

Here's what I learned building them.

## 1. Start with the CLI, Add the Web UI Later

Both projects started as command-line tools. spectr-ai began as a Node.js script that took a Solidity file path, sent it to Claude, and printed the audit report. AbiLens started as a terminal chat loop that resolved contract ABIs and let me call read functions.

The CLI-first approach forced me to get the core logic right before worrying about layout, state management, or component architecture. The engine module in spectr-ai is completely independent of the web layer — it exports functions that accept a file path and options and return structured results.

```typescript
// The core function works identically in CLI and web
async function auditContract(
  source: string,
  options: AuditOptions
): Promise<AuditReport> {
  const provider = createProvider(options.provider);
  const prompt = buildAuditPrompt(source, options.depth);
  const response = await provider.analyze(prompt);
  return parseAuditReport(response);
}
```

When I added the Next.js frontend, it was just a thin wrapper around this function. The API route calls `auditContract()` with the uploaded source and streams the result back. Zero logic duplication.

If you start with a web UI, you end up coupling business logic to React state and API routes. Starting with the CLI forces clean separation because there's no UI framework to lean on.

## 2. Provider Abstraction from Day 1

Both projects support Claude (via the Anthropic API) and Ollama (for local models). I built the provider abstraction on day one of spectr-ai, and I'm glad I did.

```typescript
interface LLMProvider {
  analyze(prompt: string): Promise<string>;
  chat(messages: Message[]): Promise<string>;
}

function createProvider(
  name: "claude" | "ollama"
): LLMProvider {
  switch (name) {
    case "claude":
      return new ClaudeProvider(process.env.ANTHROPIC_API_KEY);
    case "ollama":
      return new OllamaProvider(process.env.OLLAMA_HOST);
  }
}
```

Switching providers is a flag: `spectr-ai audit contract.sol --provider ollama`. The core logic doesn't know or care which model is answering.

Without this abstraction, swapping providers means rewriting every LLM call. The API shapes are different (Anthropic uses `messages` with `role`/`content`, Ollama has a different format), the authentication is different, and the streaming interfaces are different. The provider wrapper absorbs all of that.

This took about an hour to build. It would have taken days to retrofit.

## 3. Structured Output Is the Hard Part

The hardest part of both projects wasn't the LLM calls — it was getting structured data out of the LLM responses. When spectr-ai audits a contract, it needs a structured report with severity levels, line numbers, descriptions, and recommendations. When AbiLens parses a chat response, it needs to extract function calls with typed arguments.

LLMs don't reliably produce valid JSON. They add trailing commas, use single quotes, wrap JSON in markdown code blocks inconsistently, and sometimes produce almost-JSON that looks right but doesn't parse.

Zod saved both projects:

```typescript
const VulnerabilitySchema = z.object({
  severity: z.enum(["critical", "high", "medium", "low", "info"]),
  title: z.string(),
  description: z.string(),
  lineNumbers: z.array(z.number()).optional(),
  recommendation: z.string(),
});

const AuditReportSchema = z.object({
  summary: z.string(),
  vulnerabilities: z.array(VulnerabilitySchema),
  gasOptimizations: z.array(z.string()),
  overallRisk: z.enum(["critical", "high", "medium", "low"]),
});
```

I parse the LLM response, extract the JSON block, and run it through Zod. If validation fails, I send the error back to the LLM with the schema and ask it to fix the output. This retry loop succeeds on the second attempt about 90% of the time.

Invest in your output schemas early. Define them with Zod, validate everything, and build the retry loop. It's the difference between a demo and a product.

## 4. LLMs Are Good at Code Analysis, Not Great at Novel Reasoning

spectr-ai works well because code analysis plays to LLM strengths. Models have seen millions of Solidity files during training. They recognize patterns — reentrancy, access control gaps, integer issues — because they've seen them before.

But when I tried to make spectr-ai reason about novel protocol-level interactions ("if contract A calls contract B which calls contract C, could this create a flash loan attack vector?"), the results were unreliable. The model would confidently describe attack paths that didn't actually work, or miss obvious ones.

The lesson: design your prompts around pattern recognition, not novel reasoning. spectr-ai's prompts break the audit into specific categories — "check for reentrancy patterns," "check for access control issues," "check for integer overflow" — rather than asking "find all vulnerabilities." Each focused prompt plays to the model's strength of recognizing known patterns.

## 5. Ship Fast, Iterate in Public

spectr-ai went from empty directory to working CLI in three days. AbiLens took two days for the core chat loop. Both were rough — limited error handling, minimal tests, hardcoded configurations. But they worked.

Shipping early forced real usage. I audited actual contracts with spectr-ai and found bugs in my own prompts. I chatted with mainnet contracts through AbiLens and discovered edge cases in ABI resolution. Real usage generates real feedback faster than any amount of planning.

The iteration cycle after the initial ship was faster too. Once the architecture is in place, adding features is incremental. Adding a new vulnerability category to spectr-ai is a new prompt template and a schema update. Adding a new chain to AbiLens is a new RPC endpoint in the config.

## 6. The Best Portfolio Projects Are Tools You Actually Use

I built spectr-ai because I was manually auditing contracts and wanted to automate the boring parts. I built AbiLens because I was tired of going to Etherscan to read contract state. Both solve problems I personally have.

This matters for two reasons. First, you make better design decisions because you're the user. You know which features matter and which are noise. Second, you keep maintaining the project because you need it. Portfolio projects built for resume filler die after the initial push.

## The Numbers

Across both projects in two weeks:

- **spectr-ai**: ~3,200 lines of TypeScript, 47 tests, supports 12 vulnerability categories, CLI + web interface, 2 LLM providers
- **AbiLens**: ~1,800 lines of TypeScript, 23 tests, automatic ABI resolution for verified contracts, conversational contract interaction
- **Total development time**: ~80 hours across 14 days
- **Dependencies**: 18 (spectr-ai) and 12 (AbiLens), each justified

The code is on GitHub. Both projects are functional tools, not demos. They have error handling, test coverage, structured logging, and documentation.

Two weeks is enough time to build something real. The LLM APIs make the AI part straightforward — the engineering challenge is everything around it: structured output, provider abstraction, clean architecture, and actually shipping.

Build tools you'll use. Start with the CLI. Validate your outputs. Ship on day three and fix it on day four.
