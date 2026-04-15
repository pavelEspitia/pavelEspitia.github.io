The Provider Pattern: How I Added Ollama Support in 50 Lines

When I started building spectr-ai, it only worked with Claude. The Anthropic SDK was hardcoded everywhere — in the analysis function, the prompt formatting, the response parsing. It worked, but it meant every user needed an Anthropic API key and an internet connection.

I wanted to add Ollama support so developers could run audits locally, completely offline, using open-source models. The naive approach would have been scattering `if (useOllama)` checks throughout the codebase. Instead, I used the Provider pattern, and the entire Ollama integration took about 50 lines of code.

## The Interface

The core idea is simple: define what a "provider" does, not how it does it.

```typescript
interface Provider {
  analyze(systemPrompt: string, userContent: string): Promise<string>;
  readonly name: string;
  readonly model: string;
}
```

That's it. Three members. A provider takes a system prompt and user content, returns a string. It has a name and a model identifier. Every LLM API in existence can satisfy this contract — they all accept text and return text.

The interface deliberately returns a raw string, not a parsed object. Parsing and validation happen in a separate layer (the Zod schemas from yesterday's post). The provider's only job is to talk to the model and give back its response.

## The Anthropic Provider

```typescript
import Anthropic from "@anthropic-ai/sdk";

function createAnthropicProvider(
  apiKey: string,
  model: string,
): Provider {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",
    model,
    async analyze(systemPrompt, userContent) {
      const response = await client.messages.create({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });

      const block = response.content[0];
      if (block.type !== "text") {
        throw new Error(
          `Unexpected response type: ${block.type}`
        );
      }
      return block.text;
    },
  };
}
```

The Anthropic-specific details — the SDK client, the message format, the content block extraction — are all encapsulated. Nothing outside this function knows or cares about Anthropic's API shape.

## The Ollama Provider

```typescript
function createOllamaProvider(
  model: string,
  baseUrl: string = "http://localhost:11434",
): Provider {
  return {
    name: "ollama",
    model,
    async analyze(systemPrompt, userContent) {
      const response = await fetch(
        `${baseUrl}/api/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            stream: false,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userContent },
            ],
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Ollama returned ${response.status}: ${await response.text()}`
        );
      }

      const data = await response.json();
      return data.message.content;
    },
  };
}
```

No SDK dependency. Just a `fetch` call to Ollama's local API. The provider returns the same raw string that the Anthropic provider returns. The rest of the application can't tell the difference.

## The Factory

```typescript
interface ProviderConfig {
  provider: "anthropic" | "ollama";
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

function createProvider(config: ProviderConfig): Provider {
  switch (config.provider) {
    case "anthropic": {
      if (!config.apiKey) {
        throw new Error(
          "Anthropic provider requires an API key. " +
          "Set ANTHROPIC_API_KEY or pass --api-key."
        );
      }
      return createAnthropicProvider(
        config.apiKey,
        config.model,
      );
    }
    case "ollama": {
      return createOllamaProvider(
        config.model,
        config.baseUrl,
      );
    }
  }
}
```

The factory reads from configuration and returns the right provider. The switch is exhaustive — TypeScript will error if you add a new provider to the union type without handling it here.

## Using It

The analysis pipeline doesn't know which provider it's using:

```typescript
async function runAudit(
  provider: Provider,
  contract: string,
): Promise<AuditResult> {
  console.log(
    `Analyzing with ${provider.name} (${provider.model})...`
  );

  const raw = await provider.analyze(SYSTEM_PROMPT, contract);
  return parseAuditResult(raw);
}
```

From the CLI, the user switches with a flag:

```bash
# Use Claude (default)
spectr-ai analyze contract.sol

# Use a local Ollama model
spectr-ai analyze contract.sol --provider ollama --model llama3

# Use a specific Anthropic model
spectr-ai analyze contract.sol --model claude-sonnet-4-20250514
```

## Why This Matters

**Testing becomes trivial.** You can create a mock provider that returns predetermined responses:

```typescript
function createMockProvider(
  response: string,
): Provider {
  return {
    name: "mock",
    model: "test",
    async analyze() {
      return response;
    },
  };
}

// In tests
const provider = createMockProvider(
  JSON.stringify({
    vulnerabilities: [],
    summary: "No issues found",
    riskScore: 0,
  }),
);
const result = await runAudit(provider, sampleContract);
```

No HTTP mocking, no SDK stubs, no environment variables. Just a function that returns a string.

**Adding new providers is isolated.** Want to add OpenAI? Write a `createOpenAIProvider` function, add `"openai"` to the union type, handle it in the factory. Zero changes to the analysis pipeline, the CLI, the web frontend, or the tests.

**Users choose their tradeoffs.** Claude gives better audit quality. Ollama gives privacy, offline access, and zero API costs. The application doesn't need to have an opinion — it just needs a string back from the model.

## The Pattern Beyond LLMs

This isn't a new idea. The Provider pattern is just the Strategy pattern with a more descriptive name. You see it everywhere:

- Database drivers: same query interface, different backends (Postgres, MySQL, SQLite)
- Storage: same read/write interface, different destinations (local disk, S3, GCS)
- Auth: same verify interface, different mechanisms (JWT, session, API key)
- Logging: same log interface, different transports (console, file, remote service)

The principle is always the same: define the smallest interface that captures what you need, then implement it for each backend. The consuming code depends on the interface, never the implementation.

## What Makes a Good Provider Interface

Keep it minimal. My first draft of the Provider interface had methods for `streamAnalyze`, `countTokens`, `getModelInfo`, and `estimateCost`. I deleted all of them. The only method the application actually needed was `analyze`. Everything else was speculative — features I might want someday but didn't need today.

If you need streaming later, add a `StreamingProvider` interface that extends `Provider`. If you need token counting, add it to the providers that support it. Don't pollute the base interface with capabilities that not every implementation can satisfy.

The 50-line Ollama provider worked because the interface was small enough that any LLM API could implement it. That's the goal: an interface so simple that adding a new provider is boring. Boring is good. Boring means your abstraction is right.
