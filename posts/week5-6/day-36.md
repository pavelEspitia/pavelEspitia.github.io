---
title: "Prompt Caching Cut My Claude Bill by 80%: The Mistakes That Were Costing Me"
tags: ["ai", "typescript", "productivity", "webdev"]
publish: false
---

I was paying full price for input tokens I was sending over and over. A large system prompt, a fixed tool list, the same reference docs on every request. Prompt caching should have made those cheap, except I had three silent bugs that meant nothing was actually caching. Here is what I found when I finally checked the numbers, and how I got my hit rate from zero to consistent.

## The one rule that explains everything

Prompt caching is a prefix match. Any byte change anywhere in the prefix invalidates everything after it. The cache key is the exact bytes of the rendered prompt up to each breakpoint.

Render order is fixed: `tools`, then `system`, then `messages`. So your most stable content has to physically come first, and anything that changes per request has to come last. Get the ordering right and caching mostly works for free. Get it wrong and no amount of `cache_control` markers will save you.

## How I knew it was broken

The response `usage` object tells you the truth:

```typescript
console.log(response.usage.cache_creation_input_tokens); // written to cache (~1.25x cost)
console.log(response.usage.cache_read_input_tokens);     // served from cache (~0.1x cost)
console.log(response.usage.input_tokens);                // full price, uncached
```

I ran the same request twice and `cache_read_input_tokens` was zero both times. If the prefix were identical, the second request should have read the cache. Zero reads means a silent invalidator was changing my prefix between requests.

## Mistake 1: a timestamp in the system prompt

This was the big one:

```typescript
// WRONG: the date changes every request, so the prefix is never stable
const system = `You are a security auditor. Current date: ${new Date().toISOString()}.`;
```

The date is at the *front* of the prefix, so it invalidated everything. I did not even need the timestamp in the system prompt. I moved it into the user message, which sits after the cached prefix and invalidates nothing before it.

## Mistake 2: non-deterministic JSON

I was serializing a config object into the system prompt without sorting keys:

```typescript
// WRONG: key order can vary, changing the bytes
const system = `Config: ${JSON.stringify(config)}`;
// RIGHT
const system = `Config: ${JSON.stringify(config, Object.keys(config).sort())}`;
```

Same data, different bytes, different cache key. JavaScript does not guarantee object key order across all code paths, and iterating a `Set` is worse. Sort it, or do not put it in the prefix at all.

## Mistake 3: a per-user tool set

I built the tool list dynamically based on the user. Tools render at position 0, so a per-user tool set means nothing caches across users:

```typescript
// WRONG: different users get different tool arrays at position 0
tools: buildToolsForUser(user),
// RIGHT: a stable, deterministic tool list, sorted by name
tools: ALL_TOOLS, // gate behavior with tool_choice or message content instead
```

## Adding the breakpoint

Once the prefix was actually stable, I added one `cache_control` marker on the last system block. That caches tools plus system together:

```typescript
const response = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  system: [
    {
      type: "text",
      text: LARGE_STABLE_SYSTEM_PROMPT,
      cache_control: { type: "ephemeral" },
    },
  ],
  messages: [{ role: "user", content: userQuestion }],
});
```

## The economics

Cache reads cost about 0.1x base input price. Cache writes cost 1.25x for the 5-minute TTL. So you break even on the second request and win on every one after. For my auditor, where the system prompt and the contract-analysis instructions are identical across every call in a session, the savings were dramatic: the uncached portion shrank to just the contract source and the question.

My bill on the input side dropped roughly 80%, because the part that was constant (the bulk of the tokens) was finally being served from cache instead of paid for fresh every time.

## The audit checklist

If `cache_read_input_tokens` is stuck at zero, grep your prompt-building code for:

- `Date.now()`, `new Date()`, `time.time()` anywhere in the prefix
- `crypto.randomUUID()` or request IDs early in the content
- `JSON.stringify` without sorted keys, or iterating a `Set`
- user or session IDs interpolated into the system prompt
- tool lists that vary per request or per user

Fix those, add one breakpoint on the last stable block, and watch the read tokens climb. The bytes have to be identical. That is the whole game.
