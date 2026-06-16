---
title: "Token Counting Done Right: Stop Using tiktoken for Claude"
tags: ["ai", "typescript", "tutorial", "productivity"]
publish: false
---

I had a cost estimator that was wrong by 20%, and the reason was embarrassing: I was counting Claude tokens with `tiktoken`, which is OpenAI's tokenizer. Different model, different tokenizer, different counts. If you are estimating Claude costs or context budgets with a borrowed tokenizer, your numbers are fiction. Here is how to count correctly, and where the wrong way bites.

## Why tiktoken is wrong for Claude

`tiktoken` tokenizes for OpenAI models. Claude uses a different tokenizer. They do not agree on how text splits into tokens. On typical English prose, `tiktoken` undercounts Claude tokens by roughly 15 to 20%. On code or non-English text, the gap is worse, because tokenizers diverge most on the inputs they were not each optimized for.

So a "cost estimate" or "will this fit in context" check built on `tiktoken` is systematically off. It told me a prompt was 8,000 tokens when Claude saw closer to 9,500. Multiply that across a busy day and the budget projection is meaningfully wrong.

## The right way: the count_tokens endpoint

Claude has a dedicated endpoint for this, and the SDK wraps it. Counts are model-specific, so you pass the same model you will use for inference:

```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();

const result = await client.messages.countTokens({
  model: "claude-opus-4-8",
  messages: [{ role: "user", content: contractSource }],
});

console.log(result.input_tokens); // the real count Claude will charge for
```

This is the actual count, from the actual tokenizer, for the actual model. No approximation.

## Counting a cost estimate

Once you have the real input count, the cost math is straightforward. For Opus 4.8 at $5 per million input tokens:

```typescript
const tokens = result.input_tokens;
const inputCost = (tokens / 1_000_000) * 5; // $5/M for Opus 4.8 input
console.log(`Estimated input cost: $${inputCost.toFixed(4)}`);
```

If you are deciding between tiers, the per-million rates that matter in 2026:

| Model | Input $/M | Output $/M |
|---|---|---|
| Haiku 4.5 | 1 | 5 |
| Opus 4.8 | 5 | 25 |
| Fable 5 | 10 | 50 |

The count is the same per model only on the input side; remember output tokens dominate cost on generation-heavy tasks, and you do not know those until you run the request.

## Watch the model-specific drift

One subtlety that surprised me: token counts changed between Claude model versions. The same input text produces a *higher* count on Opus 4.7 than on Opus 4.6, because they count differently. So if you cached a token count from an older model and reused it, you would be wrong again, just less wrong than tiktoken.

The fix is to never cache a count across a model change. Re-run `countTokens` against the model you are actually using. Do not apply a blanket multiplier to convert between models; the divergence is not uniform.

## Diffing a file across versions

A handy pattern for "how many tokens did this change add" is to count both versions and subtract. The endpoint is stateless, so you just count each and diff:

```typescript
import { execSync } from "node:child_process";
import fs from "node:fs";

async function count(text: string): Promise<number> {
  const r = await client.messages.countTokens({
    model: "claude-opus-4-8",
    messages: [{ role: "user", content: text }],
  });
  return r.input_tokens;
}

const before = execSync("git show HEAD:CLAUDE.md").toString();
const after = fs.readFileSync("CLAUDE.md", "utf8");
console.log(`Delta: ${(await count(after)) - (await count(before))} tokens`);
```

I use this to keep an eye on system-prompt bloat. When a prompt creeps up by a few thousand tokens, that is real money on every cached-miss request, and the diff makes it visible.

## The takeaway

The tokenizer is part of the model. Borrowing another model's tokenizer to estimate counts is like measuring in the wrong units and hoping the error cancels. It does not cancel; it compounds. Use `countTokens` against the exact model, never reuse a count across model versions, and remember output tokens are the unknown that dominates generation cost. It is one API call, it is free, and it is the difference between a budget projection you can trust and one that is off by a fifth.
