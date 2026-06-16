---
title: "Why I Log response.model on Every Claude Call (and You Should Too)"
tags: ["ai", "typescript", "productivity", "security"]
publish: false
---

It is a one-line habit that has saved me more debugging time than any clever abstraction: I log which model actually answered every Claude request. Not which model I asked for. Which one responded. In 2026, with model fallbacks, fast-changing model strings, and routing logic, those are not always the same thing. Here is why the gap exists and what it has caught.

## The request model and the response model can differ

You send `model: "claude-fable-5"`. You assume Fable 5 answered. But the response object tells you what actually served the request:

```typescript
const response = await client.messages.create({
  model: "claude-fable-5",
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  messages: [{ role: "user", content: prompt }],
});

console.log("requested fable-5, served:", response.model);
```

Most of the time they match. The interesting cases are when they do not.

## The Fable 5 safeguard fallback

The reason this matters most in 2026 is Fable 5's safeguards. Fable 5 has hard guardrails in cybersecurity, biology, chemistry, and health. If your prompt trips one, the request does not just refuse. It silently falls back to Opus 4.8 to produce a safe answer.

For my security work, this is a sharp edge. I run contract-analysis prompts that can look adversarial to a safeguard. If one trips, I am quietly getting Opus 4.8 output while believing I am getting Fable-tier reasoning. The quality difference on a hard audit is exactly the thing I paid double for, and it vanished without an error.

The only way to know is to read `response.model`:

```typescript
if (!response.model.startsWith("claude-fable-5")) {
  logger.warn(
    { requested: "claude-fable-5", served: response.model },
    "Fable 5 request fell back, likely a safeguard trip",
  );
}
```

Without that log, a fallback is invisible until I notice the analysis got worse and have no idea why.

## Routing logic and config drift

The other source of the gap is my own code. I have routing that picks a model based on task type and a config that sets defaults. It is easy for those to drift: a config change points "deep audit" at the wrong model, or a routing bug sends classification to Opus when it should hit Haiku. Logging the served model surfaces this immediately.

```typescript
logger.info(
  { task: taskType, requested: chosenModel, served: response.model, tokens: response.usage },
  "llm call",
);
```

When my bill spiked one week, this log told me in thirty seconds that a routing change had sent a high-volume path to Opus 4.8 instead of Haiku 4.5. The five-times cost difference between those was the whole spike. Without the served-model log I would have spent an afternoon guessing.

## It is also your migration safety net

When a new model ships and I bump a model string, the served-model log is how I verify the change took effect everywhere. The migration guidance even recommends asserting on it:

```typescript
const r = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 64,
  messages: [{ role: "user", content: "ping" }],
});
console.assert(r.model.startsWith("claude-opus-4-8"), `got ${r.model}`);
```

A stray hardcoded model string in some helper I forgot about shows up the moment the served model does not match what I expect.

## Log the usage while you are at it

Since you are already logging the model, log `response.usage` in the same line. It gives you `input_tokens`, `output_tokens`, and the cache fields. That single structured log line becomes your cost dashboard: which task type, which model, how many tokens, how much was served from cache. Three fields you will want eventually, captured for free now.

```typescript
const { input_tokens, output_tokens, cache_read_input_tokens } = response.usage;
logger.info({ model: response.model, input_tokens, output_tokens, cache_read_input_tokens }, "llm");
```

## The habit

It costs one line and a structured logger. It catches silent model fallbacks, config drift, routing bugs, cost spikes, and incomplete migrations. The unifying theme is that *what you asked for and what you got are different facts*, and only one of them is in your code. The other is in the response. Read it, log it, and you will know things about your LLM usage that would otherwise only surface as a confusing bill or a quality regression with no explanation.
