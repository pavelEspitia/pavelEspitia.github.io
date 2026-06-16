---
title: "I Built a Coding Agent With the Manual Tool-Use Loop. Here's What It Taught Me"
tags: ["ai", "typescript", "tutorial", "productivity"]
publish: false
---

Everyone reaches for the SDK's tool runner because it hides the agentic loop. I wrote the loop by hand instead, for a small tool that edits files based on instructions. It was more code, and it taught me exactly what an agent is doing under the hood, which paid off the first time I needed human approval before a destructive action. Here is the manual loop, and what controlling it directly buys you.

## What the loop actually is

An "agent" sounds mysterious. It is a while loop. The model responds, and either it is done (`end_turn`) or it wants to call a tool (`tool_use`). If it wants a tool, you run the tool, feed the result back, and call the model again. Repeat until done.

```typescript
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const tools: Anthropic.Tool[] = [ /* your tool defs */ ];
let messages: Anthropic.MessageParam[] = [{ role: "user", content: task }];

while (true) {
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "xhigh" },
    tools,
    messages,
  });

  if (response.stop_reason === "end_turn") break;

  // Preserve the assistant turn, including tool_use blocks
  messages.push({ role: "assistant", content: response.content });

  const toolUses = response.content.filter(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );

  const results: Anthropic.ToolResultBlockParam[] = [];
  for (const t of toolUses) {
    const output = await runTool(t.name, t.input);
    results.push({ type: "tool_result", tool_use_id: t.id, content: output });
  }

  messages.push({ role: "user", content: results });
}
```

That is the entire thing. The tool runner does this for you. Writing it yourself means you own every step.

## The two rules that took me longest to internalize

**Always append the full `response.content`, not just the text.** The assistant turn contains the `tool_use` blocks, and the next request needs them so the `tool_result` blocks can be matched by `tool_use_id`. If you strip to just text, the model has no record it asked for a tool, and the conversation breaks.

**Every `tool_result` needs the matching `tool_use_id`.** The model fired N tool calls; you return N results, each tagged with the id it answers. Send them all in one user message. Mismatch the ids and you get a 400.

## Why I did not use the tool runner

The tool runner is great until you need to do something *between* the model deciding to call a tool and the tool actually running. For my file editor, I wanted a human to approve any write before it happened. The manual loop makes that a one-line insert:

```typescript
for (const t of toolUses) {
  if (t.name === "write_file") {
    const approved = await askHuman(`Write to ${t.input.path}? (y/n)`);
    if (!approved) {
      results.push({
        type: "tool_result",
        tool_use_id: t.id,
        content: "User denied the write. Suggest an alternative.",
        is_error: true,
      });
      continue;
    }
  }
  const output = await runTool(t.name, t.input);
  results.push({ type: "tool_result", tool_use_id: t.id, content: output });
}
```

Notice the denial goes back to the model as a tool result with `is_error: true` and a message. The model reads "user denied the write" and adapts, maybe proposing a different file or asking why. With the tool runner hiding the loop, inserting that gate is awkward. With the manual loop it is obvious.

## The gates worth adding

Once you own the loop, the natural gates appear:

- **Approval** for destructive or external actions (writes, sends, deletes).
- **Logging** of every tool call and result, which is gold for debugging why an agent did something weird.
- **A turn limit**, so a confused agent does not loop forever burning tokens.
- **Conditional execution**, like "skip this tool call if we already ran it this session."

```typescript
let turns = 0;
while (turns++ < MAX_TURNS) {
  // ...
}
if (turns >= MAX_TURNS) console.warn("hit turn limit, agent may be stuck");
```

## When to go back to the runner

I am not saying always hand-roll. For an agent with no approval gates, no special logging, and tools that are all safe to auto-run, the tool runner is less code and just as correct. The decision is whether you need to intervene between decision and action. If yes, manual loop. If no, runner.

What writing it by hand gave me, beyond the approval gate, was a real mental model. When an agent misbehaves now, I do not think "the magic broke." I think "the model returned a tool_use I did not handle" or "I fed back a malformed result." The loop is small enough to hold in your head, and holding it in your head is worth the extra code at least once.
