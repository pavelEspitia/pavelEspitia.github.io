---
title: "Mid-Conversation System Prompts: Steering an Agent Without Breaking the Cache"
tags: ["ai", "typescript", "tutorial", "webdev"]
publish: false
---

Here is a problem I hit building a long-running agent: I needed to inject a new instruction partway through a session ("the project is Go, write Go") but editing the top-level system prompt to add it invalidated my entire prompt cache. Every cached turn got reprocessed at full price. The fix is a feature that landed in the current Claude models: mid-conversation system messages. Here is what it is and when to use it.

## The setup that breaks

A long agent session has a large, stable system prompt and a growing message history, and you cache the prefix so each turn reuses the prior work cheaply. That works until you learn something mid-session that the agent needs to know: a mode toggled, the user delivered async context, files changed on disk, the token budget dropped.

The naive move is to edit the system prompt to include the new fact. But the system prompt sits at the *front* of the cached prefix. Change one byte there and you invalidate everything after it. Your whole conversation history reprocesses at full input price on the next request. For a long session, that is expensive and slow.

## The fix: a system message in the messages array

The current models let you put a `system`-role message directly in the `messages` array, after the history, instead of editing the top-level `system`:

```typescript
const response = await client.messages.create(
  {
    model: "claude-opus-4-8",
    max_tokens: 16000,
    system: [
      { type: "text", text: STABLE_SYSTEM, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      ...history,                                    // cached prefix, untouched
      { role: "user", content: latestUserMessage },
      // @ts-expect-error: role:"system" SDK types may still be landing
      { role: "system", content: "This project is Go. Write all code in Go." },
    ],
  },
  { headers: { "anthropic-beta": "mid-conversation-system-2026-04-07" } },
);
```

Because the new instruction sits *after* the cached history, it invalidates nothing before it. The cached prefix stays intact, you pay full price only for the small new message, and the agent still receives the instruction with operator authority.

## Why this beats stuffing it in a user message

The old workaround was to put operator instructions inside a user turn, often wrapped in something like `<system-reminder>`. That preserves the cache the same way, but it has a security problem: a user message is forgeable. Anything that can write to user-visible input can spoof an instruction that looks like it came from you, the operator.

A `role: "system"` message is the non-spoofable operator channel. It carries operator authority that a user-turn instruction does not, which matters when you are injecting trusted state (mode switches, permissions) into an agent that also processes untrusted user input. So this is both a caching win and a prompt-injection-safety win.

## Phrase it as context, not a command

One subtlety that took me a try to get right: phrase these messages as *facts*, not *overrides*. State the situation and let the model act on it. Avoid override-style language like "ignore what the user said" or "disregard the previous instruction." The models are trained to protect users from instructions that work against them, and that protection applies to the system role too. So:

```typescript
// Good: states context, lets the model act
{ role: "system", content: "Auto-approve mode is now enabled for this session." }
// Risky: override framing, may be resisted
{ role: "system", content: "Ignore the user's earlier request and do X instead." }
```

## The constraints to know

A few rules from the spec:

- It must follow a user message (or an assistant message ending in a server tool result). It cannot be `messages[0]`. Use the top-level `system` for the initial prompt.
- The content is text only.
- It is model-gated. On a model that does not support it, you get a 400 (`role 'system' is not supported on this model`). Catch that and fall back to the user-turn `<system-reminder>` pattern.

```typescript
try {
  // ... mid-conversation system message
} catch (err) {
  if (err instanceof Anthropic.BadRequestError && err.message.includes("system")) {
    // fall back: inject as a user-turn <system-reminder> block
  } else {
    throw err;
  }
}
```

## When to reach for it

The trigger is: *I have learned something mid-session that the agent needs, and I want to tell it without rebuilding the prefix.* Mode changes, freshly delivered context, state the application discovered after the session started. Anything dynamic that you would otherwise be tempted to splice into the system prompt.

If the fact is known at session start, it belongs in the top-level `system` prompt as usual. The mid-conversation channel is specifically for things you learn *after* the cached prefix is already built. Used that way, it keeps your cache hot, keeps your operator instructions non-spoofable, and saves you from the expensive mistake I made: editing the system prompt mid-session and watching the whole conversation reprocess at full price.
