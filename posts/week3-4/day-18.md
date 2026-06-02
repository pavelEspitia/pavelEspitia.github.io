---
title: "Structured Output From Local LLMs: JSON That Never Breaks (Ollama + Zod)"
tags: ["typescript","ai","ollama","tutorial"]
publish: false
---

A 1.5B model running on your laptop will return JSON that almost parses. The closing brace is missing. A trailing comma sneaks in. The whole thing is wrapped in a markdown fence with a chirpy "Sure! Here's your JSON:" on top. Cloud models do this too, but small local models do it constantly, and that is exactly where most "just prompt it harder" advice falls apart.

I wrote about [validating LLM responses with Zod](https://pavelespitia.hashnode.dev) before: schemas as contracts, `safeParse`, extracting JSON from chaos. That post is the foundation. This one is the local-model-specific layer on top: Ollama's native JSON modes, retry loops that actually converge, repairing truncated output, and a single `generateStructured<T>(schema)` helper that ties it all together so you never hand-roll this again.

## Two JSON Modes Most People Skip

Ollama gives you two ways to force structure before you ever touch Zod. Use them. They cut your parse-failure rate dramatically.

The first is `format: "json"`. It constrains decoding so the model can only emit syntactically valid JSON. No markdown fences, no preamble, no trailing prose.

```typescript
const res = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5-coder:7b",
    messages: [
      { role: "system", content: "Output a JSON object describing the code." },
      { role: "user", content: "function add(a, b) { return a + b }" },
    ],
    format: "json",
    stream: false,
    options: { temperature: 0 },
  }),
});

const data = await res.json();
const obj = JSON.parse(data.message.content); // already clean JSON
```

`format: "json"` guarantees valid syntax. It does not guarantee your shape. The model can still invent fields or skip required ones. That is what Zod is for.

The second mode is the one people miss: pass a full JSON Schema to `format`. Ollama then constrains generation to match the schema's structure, not just "valid JSON."

```typescript
const schema = {
  type: "object",
  properties: {
    language: { type: "string" },
    purpose: { type: "string" },
    isPure: { type: "boolean" },
  },
  required: ["language", "purpose", "isPure"],
};

const res = await fetch("http://localhost:11434/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5-coder:7b",
    messages: [{ role: "user", content: "Describe: function add(a,b){return a+b}" }],
    format: schema,
    stream: false,
    options: { temperature: 0 },
  }),
});
```

You do not want to write JSON Schema by hand and keep it in sync with your TypeScript types. You already have a Zod schema. Convert it.

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const CodeInfo = z.object({
  language: z.string(),
  purpose: z.string(),
  isPure: z.boolean(),
});

const jsonSchema = zodToJsonSchema(CodeInfo, { target: "openApi3" });
// pass jsonSchema as `format` to Ollama
```

One source of truth. Zod drives both the generation constraint and the runtime validation.

| Mode | Forces valid syntax | Forces your shape | Cost |
|------|--------------------|--------------------|------|
| Plain prompt | No | No | Free, unreliable |
| `format: "json"` | Yes | No | Negligible |
| `format: <schema>` | Yes | Mostly | Slower decode, fewest retries |

On small models, `format: <schema>` is worth the slightly slower decode because it turns most three-attempt loops into one.

## Repairing Truncated JSON

Schema-constrained decoding still breaks in one nasty way: the model hits its token limit mid-object. You get `{"vulnerabilities": [{"id": "V1", "severity": "hi` and a dead parse.

Two defenses. First, raise `num_predict` so the model has room to finish.

```typescript
options: { temperature: 0, num_predict: 2048 }
```

Second, attempt a repair before you give up. The common failure is unclosed brackets and a dangling partial value. You can salvage a surprising amount by trimming to the last complete token and closing what is open.

```typescript
function repairJson(raw: string): string {
  let text = raw.trim();

  // Drop a trailing partial string/number/key after the last comma or brace
  const lastSafe = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastSafe !== -1) text = text.slice(0, lastSafe + 1);

  // Walk the string, tracking open brackets outside of string literals
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }

  // Close whatever is still open, innermost first
  while (stack.length) text += stack.pop();
  return text;
}
```

This is a last resort, not a primary strategy. If you trim a truncated array, you lose the cut-off element, which is fine for "best effort" reads and wrong for anything that must be complete. I gate it: try the raw parse, then the repaired parse, and if the repaired version loses data the schema requires, Zod rejects it and the retry loop takes over.

## Retry Loops That Converge

The naive retry resends the same prompt and prays. It does not converge because nothing changed. The version that works feeds the specific Zod error back into the next attempt, the same idea from the earlier post but tuned for local models: lower the temperature on retries and tighten the instruction.

```typescript
async function withRetry<T>(
  attempt: (feedback: string | null) => Promise<string>,
  parse: (raw: string) => z.SafeParseReturnType<unknown, T>,
  maxAttempts = 3,
): Promise<T> {
  let feedback: string | null = null;

  for (let i = 1; i <= maxAttempts; i++) {
    const raw = await attempt(feedback);
    const parsed = parse(raw);
    if (parsed.success) return parsed.data;

    feedback = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
      .join("\n");
  }

  throw new Error(`No valid output after ${maxAttempts} attempts:\n${feedback}`);
}
```

The discipline is: the model never sees a generic "that was wrong." It sees `vulnerabilities.0.severity: Invalid enum value. Expected 'high', received 'High'`. Small models self-correct from that. They cannot self-correct from silence.

## Streaming and Parsing Together

You want streaming for UX (tokens appearing live) but you cannot parse JSON until it is complete. Resolve the tension by streaming for display and accumulating for parsing. Do not try to parse each chunk.

```typescript
async function streamAccumulate(
  body: object,
  onToken?: (t: string) => void,
): Promise<string> {
  const res = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!res.body) throw new Error("No response body from Ollama");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Ollama streams newline-delimited JSON objects, one per chunk
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const token = JSON.parse(line).message?.content ?? "";
      full += token;
      onToken?.(token);
    }
  }

  return full;
}
```

The trap people fall into: Ollama's `/api/chat` stream is newline-delimited JSON, one envelope per line, and a single network chunk can split a line in half. That is why `buffer` keeps the trailing partial line and only parses complete ones. Parse the accumulated `full` once the stream ends. Never on a partial.

## The Helper That Ties It Together

Here is the piece I actually reuse. One generic function: pass a Zod schema, get back a typed, validated object, with schema-constrained generation, repair, and retry all handled.

```typescript
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

interface StructuredOptions {
  model?: string;
  temperature?: number;
  maxAttempts?: number;
  numPredict?: number;
}

export async function generateStructured<T>(
  schema: z.ZodType<T>,
  system: string,
  user: string,
  opts: StructuredOptions = {},
): Promise<T> {
  const {
    model = "qwen2.5-coder:7b",
    temperature = 0,
    maxAttempts = 3,
    numPredict = 2048,
  } = opts;

  const jsonSchema = zodToJsonSchema(schema, { target: "openApi3" });

  const call = async (feedback: string | null): Promise<string> => {
    const messages = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];
    if (feedback) {
      messages.push({
        role: "user",
        content: `Your last response failed validation:\n${feedback}\nReturn corrected JSON only.`,
      });
    }

    const res = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        format: jsonSchema,
        stream: false,
        options: { temperature, num_predict: numPredict },
      }),
    });

    const data = await res.json();
    return data.message?.content ?? "";
  };

  const parse = (raw: string): z.SafeParseReturnType<unknown, T> => {
    for (const candidate of [raw, repairJson(raw)]) {
      try {
        return schema.safeParse(JSON.parse(candidate));
      } catch {
        // not parseable, try the next candidate
      }
    }
    // Force a Zod failure with a useful message
    return schema.safeParse(undefined);
  };

  return withRetry(call, parse, maxAttempts);
}
```

Usage is the part that makes the abstraction worth it.

```typescript
const CodeReview = z.object({
  summary: z.string(),
  issues: z.array(z.object({
    severity: z.enum(["high", "medium", "low"]),
    line: z.number().int().positive(),
    note: z.string(),
  })),
  riskScore: z.coerce.number().min(0).max(100),
});

const review = await generateStructured(
  CodeReview,
  "You are a code reviewer. Output JSON only.",
  sourceCode,
  { model: "ollama-friendly", maxAttempts: 3 },
);

// review is fully typed as z.infer<typeof CodeReview>, validated, never undefined
```

`review.issues[0].severity` is typed. Your editor autocompletes it. If the model returns `"High"`, the `z.enum` rejects it, the error flows back into the retry, and the next attempt fixes it. You wrote the schema once.

## What I Learned Wiring This Into spectr-ai

1. **Constrain generation, then validate.** `format: <schema>` and Zod are not redundant. The first reduces how often you fail; the second catches what slips through.
2. **One Zod schema, two jobs.** `zodToJsonSchema` keeps the generation constraint and the runtime check from drifting apart.
3. **Repair is a fallback, never the plan.** Closing brackets salvages reads. It silently drops data on truncated arrays, so let Zod reject anything that must be complete.
4. **Stream for the eyes, accumulate for the parser.** Buffer newline-delimited chunks, parse once at the end.
5. **Retries need the actual error.** Feed Zod's path-and-message back in. Small models converge from specifics, not from "try again."

This is the exact pattern [spectr-ai](https://github.com/pavelEspitia/spectr-ai) uses to run a smart-contract audit fully locally with `--model ollama:qwen2.5-coder:1.5b`. Every byte the model emits passes through `generateStructured`. The 1.5B model still fumbles the JSON. The user never sees it.
