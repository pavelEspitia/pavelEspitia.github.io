Zod + LLMs: How to Validate AI Responses Without Losing Your Mind

You ask an LLM a carefully crafted question with a system prompt demanding JSON output. You get back a beautifully formatted response wrapped in triple backticks, prefixed with "Here's the JSON you requested:", and trailing with "Let me know if you need any changes!" The actual JSON is buried somewhere in the middle. Sometimes it's valid. Sometimes it's not.

This is the fundamental challenge of building tools on top of LLMs: they're probabilistic text generators, not API endpoints. And if you're using smaller local models through Ollama, the problem gets worse. Much worse.

Here's how I solved it in spectr-ai, an AI-powered smart contract auditor, using Zod for runtime validation.

## The Schema Is Your Contract

Every structured response from the LLM passes through a Zod schema. The schema defines exactly what shape the data must have, what types each field must be, and what values are acceptable.

```typescript
import { z } from "zod";

const SeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);

const VulnerabilitySchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  description: z.string(),
  lineStart: z.number().int().positive(),
  lineEnd: z.number().int().positive(),
  recommendation: z.string(),
});

const AuditResultSchema = z.object({
  vulnerabilities: z.array(VulnerabilitySchema),
  summary: z.string(),
  riskScore: z.number().min(0).max(100),
});

type AuditResult = z.infer<AuditResult>;
```

The `z.infer` at the bottom is the magic — your runtime validation and your TypeScript types are derived from the same source. No drift between what you validate and what you type-check.

## Extracting JSON from LLM Chaos

LLMs love wrapping their JSON in markdown fences, adding explanatory text, or returning partial objects. The first step is extracting the actual JSON from whatever the model sends back.

```typescript
function extractJson(raw: string): string {
  // Strip markdown code fences
  const fencePattern = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/;
  const match = raw.match(fencePattern);
  if (match?.[1]) {
    return match[1].trim();
  }

  // Try to find a JSON object directly
  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");
  if (objectStart !== -1 && objectEnd > objectStart) {
    return raw.slice(objectStart, objectEnd + 1);
  }

  // Last resort: return the raw string and let Zod handle the error
  return raw.trim();
}
```

This function handles the three most common cases: JSON wrapped in code fences, JSON with surrounding text, and bare JSON. The key insight is that `lastIndexOf("}")` grabs the outermost closing brace, so even if there's trailing text, you still get the complete object.

## safeParse Over parse, Every Time

Zod offers two parsing methods: `parse` throws on invalid input, `safeParse` returns a discriminated union. For LLM responses, always use `safeParse`.

```typescript
function parseAuditResult(raw: string): AuditResult {
  const json = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new ParseError(
      `LLM returned invalid JSON. ` +
      `First 200 chars: ${json.slice(0, 200)}`
    );
  }

  const result = AuditResultSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new ParseError(
      `LLM response failed schema validation:\n${issues}`
    );
  }

  return result.data;
}
```

Why `safeParse`? Because `parse` throws a `ZodError` with a stack trace and internal formatting that's useless for debugging LLM behavior. With `safeParse`, you control the error message. You can log exactly which fields failed and why, include a preview of the raw response, and surface something actionable to the user.

## The Error Messages Matter

When a local model returns garbage, you need to know *why* it failed. Zod's error issues tell you exactly what went wrong:

```
LLM response failed schema validation:
  vulnerabilities.0.severity: Invalid enum value.
    Expected 'critical' | 'high' | 'medium' | 'low' | 'informational',
    received 'Critical'
  riskScore: Expected number, received string
```

That first error is incredibly common with smaller models — they capitalize enum values, use "High" instead of "high", or invent new severity levels like "moderate". The fix is either to normalize the data before validation or to make your schema more forgiving:

```typescript
const SeveritySchema = z
  .string()
  .transform((s) => s.toLowerCase())
  .pipe(
    z.enum([
      "critical",
      "high",
      "medium",
      "low",
      "informational",
    ])
  );
```

The `transform` + `pipe` pattern lets you preprocess the value before validating it. The input is any string, the transform lowercases it, and the pipe validates the transformed value against the enum. Clean and composable.

## Handling the riskScore Problem

Models frequently return `"85"` instead of `85` — a string instead of a number. You can handle this with `z.coerce`:

```typescript
const AuditResultSchema = z.object({
  vulnerabilities: z.array(VulnerabilitySchema),
  summary: z.string(),
  riskScore: z.coerce.number().min(0).max(100),
});
```

`z.coerce.number()` calls `Number()` on the input first. So `"85"` becomes `85`, and `"not a number"` becomes `NaN` which fails the subsequent validation. This is the right tradeoff: be lenient on types the model frequently gets wrong, strict on values.

## Retry With Context

Sometimes the model just fails. When it does, retry with the error message injected into the prompt:

```typescript
async function auditWithRetry(
  provider: Provider,
  contract: string,
  maxAttempts: number = 3,
): Promise<AuditResult> {
  let lastError = "";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const prompt = lastError
      ? `${basePrompt}\n\nYour previous response had errors:\n${lastError}\nPlease fix and respond with valid JSON only.`
      : basePrompt;

    const raw = await provider.analyze(prompt, contract);

    try {
      return parseAuditResult(raw);
    } catch (err) {
      lastError = err instanceof ParseError ? err.message : String(err);
    }
  }

  throw new Error(
    `Failed to get valid response after ${maxAttempts} attempts. Last error: ${lastError}`
  );
}
```

This works surprisingly well. Most models self-correct when you tell them what went wrong. The key is including the specific Zod error — "severity must be one of critical, high, medium, low, informational" gives the model enough context to fix its output.

## What I Learned

1. **Never trust LLM output.** Validate everything at the boundary, just like you would with user input or API responses.

2. **safeParse is non-negotiable.** You need control over error formatting to debug model behavior.

3. **Be lenient on representation, strict on semantics.** Use `z.coerce` and `transform` for type mismatches. Keep enum validation tight.

4. **Extract JSON defensively.** Models wrap, prefix, suffix, and annotate their JSON output in creative ways.

5. **Retry with error context.** Models are good at self-correction when you tell them exactly what failed.

The combination of Zod's runtime validation and TypeScript's static types gives you a safety net that catches model failures before they propagate through your application. Your schema becomes the contract between your code and the LLM — and unlike the LLM, Zod never hallucinates.
