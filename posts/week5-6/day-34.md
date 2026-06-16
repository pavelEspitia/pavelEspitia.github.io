---
title: "Hybrid Local + Cloud LLMs in 2026: When to Use Ollama and When to Pay for Fable"
tags: ["ai", "ollama", "productivity", "typescript"]
publish: false
---

I run a local model and I pay for cloud models, and the most common question I get is "which one should I use?" The honest answer is both, on the same task, at different stages. After a year of building tools that use Ollama and Claude together, here is the decision framework I actually apply, updated for the mid-2026 landscape where the top cloud tier now costs $50 per million output tokens.

## The cost gap got wider, which makes the question sharper

In 2026 the cloud frontier spread out into a clear ladder:

- Haiku 4.5: $1 / $5 per million tokens
- Opus 4.8: $5 / $25
- Fable 5: $10 / $50

Local is $0 per token after you own the hardware. A 2024-era laptop runs `qwen2.5-coder:7b` well enough for real work. The gap between "free and on my machine" and "$50 per million output tokens" is large enough that throwing every request at the frontier is a real waste of money.

So the framework is not "local or cloud." It is "what is the cheapest tier that gets this specific step right?"

## The three questions I ask per step

**1. Does this step leave my machine's privacy boundary?**

If I am analyzing a client's unpublished contract or a private repo, that content does not go to a cloud API unless I have explicit permission. Local model, full stop. This is not a cost decision. It is a trust decision.

**2. Is this step hard, or is it bulk?**

Bulk work (chunking, first-pass extraction, classification, "is this file even relevant") goes local. Hard reasoning (the actual vulnerability analysis, the tricky cross-function logic, the final report) goes cloud. The 7B local model is genuinely fine at the bulk. It is not Fable 5 at the hard part, and pretending otherwise produces confident wrong answers.

**3. What does being wrong cost?**

A wrong classification I can re-run for free. A wrong security finding in a report I hand to a client costs my reputation. The cost-of-error maps directly onto the tier. Cheap-to-fix errors go to cheap models.

## What this looks like in code

Here is the shape of a hybrid pipeline from one of my tools. Local model triages, cloud model does the heavy reasoning only on what survives triage:

```typescript
import { Ollama } from "ollama";
import Anthropic from "@anthropic-ai/sdk";

const local = new Ollama();
const cloud = new Anthropic();

async function triage(file: string): Promise<boolean> {
  const r = await local.generate({
    model: "qwen2.5-coder:7b",
    prompt: `Does this contract have external calls, delegatecall, or asset transfers? Answer yes or no only.\n\n${file}`,
  });
  return r.response.toLowerCase().includes("yes");
}

async function deepAudit(file: string) {
  return cloud.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "xhigh" },
    messages: [{ role: "user", content: `Audit this contract:\n\n${file}` }],
  });
}

async function pipeline(files: string[]) {
  const results = [];
  for (const f of files) {
    if (await triage(f)) {
      results.push(await deepAudit(f)); // pays for cloud only on interesting files
    }
  }
  return results;
}
```

If half my files are boilerplate that fails triage, I just halved my cloud bill, and the local triage cost me nothing.

## When I reach for Fable 5 specifically

Almost never by default. Opus 4.8 is my cloud workhorse. I escalate to Fable 5 only when:

- The task is long-horizon agentic work where one mistake cascades.
- I have already tried Opus 4.8 and it missed something I know matters.
- The correctness genuinely justifies double the cost.

For a security report, the math can work, because a missed finding is far more expensive than the token difference. For "summarize this PR," it never works.

## The anti-pattern: frontier for everything

The mistake I see most is reaching for the most capable model on every call because it "can't hurt." It can hurt. It hurts your latency (more thinking) and your bill (more dollars), and for bulk steps it gives you no measurable quality gain. The local 7B model answering "is this file relevant" in 200ms for free is the right tool. Save the $50-per-million tier for the moments that are actually hard.

Local for privacy and bulk. Cloud for reasoning. Frontier only when being wrong is expensive. That is the whole framework.
