---
title: "Adaptive Thinking Killed My Token Budget Code: Migrating Off budget_tokens"
tags: ["ai", "typescript", "tutorial", "productivity"]
publish: false
---

I had a tidy little helper that computed a thinking budget based on input size. Something like "give the model 30% of the context as thinking room." It worked great on Opus 4.5. Then I tried to point it at Opus 4.8 and got a 400. The whole concept I had built around is gone in the current models. Here is what replaced it and how I migrated.

## What broke

The old pattern looked like this:

```typescript
// Opus 4.5 and earlier
const response = await client.messages.create({
  model: "claude-opus-4-5",
  max_tokens: 16000,
  thinking: { type: "enabled", budget_tokens: 8000 },
  messages,
});
```

On Opus 4.7, 4.8, and Fable 5, `thinking: { type: "enabled", budget_tokens: N }` returns a 400. The fixed token budget is dead. The replacement is adaptive thinking, where the model decides how much to think, plus an `effort` knob that controls overall token spend.

```typescript
// Opus 4.8
const response = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  output_config: { effort: "high" }, // low | medium | high | xhigh | max
  messages,
});
```

## Why this is actually better (after I got over it)

My old budget code was a guess dressed up as a calculation. I had no real basis for "30% of context." I picked it because it felt reasonable and the outputs looked fine. Adaptive thinking moves that decision to the model, which sees the actual problem.

The mental model shift: `budget_tokens` controlled how much the model could think. `effort` controls how much it thinks *and acts*. They are not the same axis, so there is no clean 1:1 mapping. I stopped trying to translate "8000 tokens" into an effort level and instead picked based on the workload.

## How I chose effort levels

After running my own evals, here is where I landed:

| Workload | Effort | Notes |
|---|---|---|
| Classification, routing | `low` | Fast, scoped, not intelligence-sensitive |
| Most app traffic | `medium` to `high` | The balance point |
| Coding and agentic loops | `xhigh` | Best for these; it is the Claude Code default |
| Correctness-critical, latency-insensitive | `max` | When being wrong costs more than tokens |

One thing that surprised me: higher effort up front often *reduced* total cost on agentic work because the model planned better and took fewer turns. I had assumed `max` always meant more tokens. On multi-step tasks, it sometimes meant fewer.

## The migration checklist I actually used

1. Grep for `budget_tokens` across the codebase.
2. Replace `thinking: { type: "enabled", budget_tokens: N }` with `thinking: { type: "adaptive" }`.
3. Add `output_config: { effort: "..." }` and pick a level per call site, not one global value.
4. Delete the budget-calculation helper entirely. It was dead weight.
5. Strip any `temperature` / `top_p` / `top_k` params (those also 400 on 4.7+).
6. Run one test request per model and assert on `response.model`.

```typescript
const r = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 64,
  thinking: { type: "adaptive" },
  messages: [{ role: "user", content: "ping" }],
});
console.assert(r.model.startsWith("claude-opus-4-8"), r.model);
```

## One gotcha with thinking display

On Opus 4.7+ and Fable 5, thinking blocks still stream but their text is empty by default. If you were rendering reasoning to a UI, you now see a long pause instead of progress. Opt back in:

```typescript
thinking: { type: "adaptive", display: "summarized" }
```

I missed this for an afternoon and thought streaming was broken. It was just the new default (`omitted`).

## The lesson

I built abstraction on top of a parameter that the platform later removed. That is the risk of wrapping a vendor knob in your own logic before you understand whether the knob is fundamental or incidental. `budget_tokens` was incidental. The fundamental thing was "let the model think when it helps," and adaptive thinking expresses that directly. Less of my code, more of theirs, and the outputs got better. I will take that trade.
