Building a Chat Interface Over Any API with TypeScript

Most AI chat interfaces do the same thing: the user types a message, the LLM generates text, and it appears on screen. But the interesting pattern is when the LLM *does something* — calls an API, queries a database, runs a command — and then explains what happened.

I built this pattern into AbiLens, a tool that lets you chat with any EVM smart contract. But the architecture generalizes to any external API. You can use the same approach to build a chat interface over a REST API, a database, a CLI tool, or any service with a programmatic interface.

Here's how it works.

## The Architecture

The flow has four steps:

1. User sends a message
2. LLM decides what API call to make (or responds directly if no call is needed)
3. Your code executes the API call
4. LLM explains the result to the user

The key insight: the LLM never calls the API directly. It outputs a structured JSON object describing the call it wants to make. Your code validates and executes it. This keeps the LLM in a sandbox — it can only do what you allow.

```
User Message
    ↓
System Prompt (with available functions)
    ↓
LLM Response (JSON function call OR plain text)
    ↓
Your Code (validates, executes the call)
    ↓
API Result
    ↓
LLM Explanation (human-readable summary)
```

## The System Prompt Template

The system prompt is where you define what the LLM can do. You list every available function with its name, description, and parameters.

```typescript
function buildSystemPrompt(
  functions: FunctionDefinition[]
): string {
  const functionList = functions
    .map((fn) => {
      const params = fn.parameters
        .map((p) => `  - ${p.name}: ${p.type} — ${p.description}`)
        .join("\n");
      return `### ${fn.name}\n${fn.description}\n${params}`;
    })
    .join("\n\n");

  return `You are an assistant that helps users interact with an API.

When the user asks a question that requires data, respond with a JSON function call:
\`\`\`json
{ "function": "functionName", "args": { "key": "value" } }
\`\`\`

When you can answer directly without data, respond in plain text.

Available functions:
${functionList}

Always explain the results in plain language after receiving them.`;
}
```

For AbiLens, the functions are dynamically generated from the contract's ABI. For a REST API, you'd define them from your OpenAPI spec. For a database, they'd map to common queries.

```typescript
interface FunctionDefinition {
  name: string;
  description: string;
  parameters: ParameterDefinition[];
}

interface ParameterDefinition {
  name: string;
  type: string;
  description: string;
  required: boolean;
}
```

## Extracting Function Calls from the LLM Response

The LLM's response is either plain text or contains a JSON function call. You need to detect which one it is and extract the structured data.

```typescript
import { z } from "zod";

const FunctionCallSchema = z.object({
  function: z.string(),
  args: z.record(z.unknown()),
});

type FunctionCall = z.infer<typeof FunctionCallSchema>;

function extractFunctionCall(
  response: string
): FunctionCall | null {
  const jsonMatch = response.match(
    /```json\s*([\s\S]*?)```/
  );
  if (!jsonMatch?.[1]) return null;

  const parsed = FunctionCallSchema.safeParse(
    JSON.parse(jsonMatch[1].trim())
  );
  if (!parsed.success) return null;

  return parsed.data;
}
```

Zod validation here is not optional. LLMs produce malformed JSON, hallucinate function names, and invent parameters. Parse and validate before you execute anything.

## Executing the Calls

Map function names to actual implementations. Each handler receives validated arguments and returns a result.

```typescript
type FunctionHandler = (
  args: Record<string, unknown>
) => Promise<unknown>;

class FunctionRouter {
  private handlers = new Map<string, FunctionHandler>();

  register(
    name: string,
    handler: FunctionHandler
  ): void {
    this.handlers.set(name, handler);
  }

  async execute(call: FunctionCall): Promise<unknown> {
    const handler = this.handlers.get(call.function);
    if (!handler) {
      throw new Error(
        `Unknown function: ${call.function}`
      );
    }
    return handler(call.args);
  }
}
```

For a REST API wrapper, registration looks like this:

```typescript
const router = new FunctionRouter();

router.register("getUser", async (args) => {
  const id = z.string().parse(args.id);
  const response = await fetch(`/api/users/${id}`);
  return response.json();
});

router.register("listOrders", async (args) => {
  const status = z.string().optional().parse(args.status);
  const url = new URL("/api/orders", baseUrl);
  if (status) url.searchParams.set("status", status);
  const response = await fetch(url);
  return response.json();
});
```

## Feeding Results Back

After executing the function, send the result back to the LLM for explanation. The conversation history now includes the user's question, the LLM's function call, and the raw result.

```typescript
async function handleMessage(
  userMessage: string,
  history: Message[],
  router: FunctionRouter,
  llm: LLMClient
): Promise<string> {
  history.push({ role: "user", content: userMessage });

  const response = await llm.chat(history);
  const functionCall = extractFunctionCall(response);

  if (!functionCall) {
    history.push({ role: "assistant", content: response });
    return response;
  }

  const result = await router.execute(functionCall);
  const resultText = JSON.stringify(result, null, 2);

  history.push({ role: "assistant", content: response });
  history.push({
    role: "user",
    content: `Function result:\n${resultText}\n\nExplain this result to the user.`,
  });

  const explanation = await llm.chat(history);
  history.push({
    role: "assistant",
    content: explanation,
  });
  return explanation;
}
```

The second LLM call is where the value lives. Raw API responses are JSON blobs. The LLM transforms them into answers: "The user has 3 pending orders totaling $142.50, the most recent one placed yesterday."

## Error Handling

Things go wrong. The API returns 500. The LLM hallucinates a function that doesn't exist. The arguments are the wrong type. Handle all of these gracefully by feeding the error back to the LLM.

```typescript
try {
  const result = await router.execute(functionCall);
  // ... feed result back
} catch (error) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : "Unknown error";

  history.push({
    role: "user",
    content: `The function call failed: ${errorMessage}. Let the user know and suggest alternatives.`,
  });

  return llm.chat(history);
}
```

This creates a self-correcting loop. The LLM sees the error, explains what went wrong, and often suggests a different approach.

## Where This Pattern Works

This same architecture applies beyond smart contracts:

- **Database explorer**: Define functions for common queries (`getTableSchema`, `runQuery`, `listTables`). The LLM translates natural language into SQL and explains the results.
- **DevOps assistant**: Functions for `getDeployStatus`, `listPods`, `getLogsTail`. Chat with your infrastructure.
- **API documentation**: Point it at any REST API and let users explore endpoints conversationally.
- **CLI wrapper**: Functions map to CLI commands. The LLM picks the right flags and explains the output.

The pattern always looks the same: define available functions, let the LLM choose which to call, execute in a sandbox, explain the results.

## Practical Tips

**Keep the function list short.** More than 15-20 functions degrades LLM accuracy. Group related operations or use a two-step approach where the LLM first picks a category, then a specific function.

**Include examples in function descriptions.** "Returns the user's order history. Example: `{ 'userId': '123', 'limit': 10 }`" helps the LLM format arguments correctly.

**Log every function call.** You want a complete audit trail of what the LLM asked for, what you executed, and what came back. This is essential for debugging and for trust.

**Rate limit aggressively.** The LLM doesn't know about your API quotas. Add rate limiting in your router, not in the LLM prompt.

The full AbiLens source is on my GitHub if you want to see this pattern applied to smart contract interaction. The core chat loop is under 200 lines — most of the complexity lives in the function definitions, not the orchestration.
