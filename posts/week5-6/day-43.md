---
title: "Effort Levels in Practice: I Benchmarked low Through max on Real Tasks"
tags: ["ai", "productivity", "typescript", "tutorial"]
publish: false
---

The current Claude models give you an `effort` knob with five settings: `low`, `medium`, `high`, `xhigh`, `max`. The docs tell you what each is for. I wanted numbers, so I ran the same three real tasks across all five levels and measured tokens, latency, and quality. The results changed how I set effort, and one of them surprised me. Here is the data and what I do with it now.

## What effort controls

Effort is not just "how much the model thinks." It controls overall token spend: how much it thinks *and* how it acts. Lower effort means fewer, more consolidated tool calls, less preamble, terser output. Higher effort means more exploration before answering. The default is `high` if you omit it.

```typescript
const response = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  output_config: { effort: "medium" }, // the knob
  messages,
});
```

## The three tasks

I picked tasks that span the range of what I actually do:

1. **Classification**: label a contract finding as low/medium/high/critical. Short, scoped.
2. **Code generation**: write a TypeScript function with edge-case handling. Medium difficulty.
3. **Multi-step audit**: analyze a 200-line contract for vulnerabilities across functions. Hard, agentic.

I ran each at all five effort levels, three times, and averaged. I scored quality against a known-correct answer for tasks 1 and 3, and by manual review for task 2.

## The results

**Task 1, classification.** Quality was flat across every effort level. The right label is the right label, and the model nailed it at `low` just as well as at `max`. But token usage climbed steeply: `max` used roughly 8x the tokens of `low` for an identical answer. Latency tracked tokens.

The lesson: for genuinely simple, scoped tasks, high effort is pure waste. I set classification to `low`.

**Task 2, code generation.** Quality improved from `low` to `high`, then plateaued. At `low` the model sometimes skipped an edge case. At `high` it caught them. `xhigh` and `max` produced essentially the same code as `high` but spent more tokens getting there. Sweet spot: `high`.

**Task 3, the multi-step audit. This is the one that surprised me.** I expected token usage to climb monotonically with effort, like task 1. Instead, total tokens were *lower* at `xhigh` than at `medium` for this task. At `medium`, the model explored less per step, took more turns, hit some dead ends, and re-derived things. At `xhigh`, it planned better up front and finished in fewer turns. Higher per-step effort, fewer steps, lower total cost. And the quality was clearly best at `xhigh`.

## The counterintuitive bit

I had been treating effort as a cost dial: turn it up, pay more. For one-shot tasks, that holds. For multi-step agentic work, it does not. Higher effort can *reduce* total cost because better planning means fewer wasted turns. The relationship is not monotonic once a feedback loop is involved.

That matches what Anthropic says about the agentic-coding default being `xhigh`. I had read it as "they want the best quality regardless of cost." After the benchmark, I read it as "for agentic work, xhigh is often cheaper *and* better." Both, really.

## How I set effort now

A per-call-site decision, not a global default:

| Task type | Effort | Why |
|---|---|---|
| Classification, routing, extraction | `low` | Quality flat, tokens scale, no reason to pay |
| Single-shot code or content | `high` | Quality plateaus here; higher is waste |
| Agentic loops, multi-step audits | `xhigh` | Better planning, fewer turns, often cheaper |
| Correctness over everything, rare | `max` | Only when a wrong answer costs more than the tokens |

## Run your own

My numbers are for my tasks. Yours will differ. The point is not to copy my table; it is to stop guessing. Pick three representative tasks, run them across the five levels, and measure tokens and quality. It took me an afternoon and saved me from two wrong defaults: paying high effort for classification (waste) and being scared of high effort on agentic work (wrong, it was cheaper).

The knob is cheap to test and expensive to leave on the wrong setting. Measure it once.
