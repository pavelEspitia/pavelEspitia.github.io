---
title: "Structured Outputs vs Tool Use vs Prefills: Getting JSON Out of Claude in 2026"
tags: ["ai", "typescript", "tutorial", "webdev"]
publish: false
---

For a long time the trick to force a model into JSON was to prefill the assistant turn with an opening brace. That trick is dead on the current Claude models. It returns a 400. If you are still doing it, your code breaks the moment you bump the model string. Here is the modern way to get reliable structured output, and how to pick between the two approaches that replaced prefills.

## What broke

The old pattern:

```typescript
// WRONG on Opus 4.6+, Fable 5: prefilling the last assistant turn now 400s
messages: [
  { role: "user", content: "Extract the name." },
  { role: "assistant", content: '{"name": "' }, // forced JSON start
]
```

This returned a 400 the first time I tried it on Opus 4.8. Last-assistant-turn prefills are no longer supported on Opus 4.6, 4.7, 4.8, or Fable 5. The replacement depends on what the prefill was doing.

## Option 1: structured outputs (when you want a specific shape)

If the prefill was forcing a JSON schema, the direct replacement is `output_config.format`. The SDK validates the response against your schema automatically, and with Zod you get type safety for free:

```typescript
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const Finding = z.object({
  vulnerability: z.string(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  function_name: z.string(),
  line: z.number(),
});

const response = await client.messages.parse({
  model: "claude-opus-4-8",
  max_tokens: 16000,
  messages: [{ role: "user", content: `Find the bug:\n\n${contract}` }],
  output_config: { format: zodOutputFormat(Finding) },
});

// Typed and validated. null if parsing failed.
console.log(response.parsed_output?.severity);
```

The output is guaranteed to match the schema or `parsed_output` is null. No regex, no `JSON.parse` in a try/catch, no "the model added a markdown fence again."

A few schema limits to know: numerical constraints like `minimum`/`maximum` are not enforced server-side (the SDK strips them and validates client-side), recursive schemas are not supported, and every object needs `additionalProperties: false`. The Zod helper handles most of this for you.

## Option 2: tool use (when JSON is a side effect of an action)

If what you really want is for the model to *do* something with structured arguments, a tool is the cleaner fit. The classic case is classification: you want a label, and the label is the tool input.

```typescript
const response = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 1024,
  tools: [{
    name: "classify_severity",
    description: "Record the severity classification of a finding.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
      },
      required: ["severity"],
      additionalProperties: false,
    },
  }],
  tool_choice: { type: "tool", name: "classify_severity" },
  messages: [{ role: "user", content: `Classify:\n\n${finding}` }],
});
```

With `strict: true` the arguments are guaranteed valid against the schema. Forcing `tool_choice` to the specific tool means the model has to call it.

## How I choose between them

The deciding question: is the JSON the *answer*, or is the JSON the *arguments to an action*?

- The answer is a structured object I will parse and use directly? Structured outputs (`output_config.format`).
- The model is one step in a loop and the JSON is what gets passed to the next tool? Tool use.
- I am extracting fields from text into a record? Structured outputs.
- I am building an agent that picks among operations? Tool use.

For my auditor, the report is the answer, so I use structured outputs. For the routing logic that decides which analysis pass to run, the decision is an action, so I use a tool.

## What replaced the other prefill tricks

Prefills were used for more than JSON. Here is the mapping:

- Forcing a classification label: tool with an enum, or structured outputs.
- Skipping preambles ("Here is the summary:"): system prompt instruction, "respond directly without preamble."
- Steering around bad refusals: usually unnecessary now; the current models refuse far more appropriately, so plain prompting works.
- Continuing an interrupted response: put the continuation in the user turn, "your previous response ended with X, continue from there."

## The takeaway

The prefill hack worked by exploiting how the model continues text. The modern features work by constraining the output format at the API level, which is both more reliable and impossible to break with a model bump. If you are still prefilling braces, you are one model-string change away from a 400. Move to structured outputs or tool use and stop fighting the formatter.
