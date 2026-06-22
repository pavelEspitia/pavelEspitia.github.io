---
title: "Function Calling with Ollama: Make Your Local LLM Run Real Tools"
tags: ["ai", "ollama", "typescript", "tutorial"]
publish: true
---

# Function Calling with Ollama: Make Your Local LLM Run Real Tools

Most Ollama tutorials end at chat completion. The interesting stuff starts when the model can call your code.

Function calling is the protocol that lets an LLM say "I want to call `getWeather(city: 'Bogotá')`" instead of trying to fake the answer from training data. Cloud models like GPT and Claude have had it for over a year. Ollama supports it natively for compatible models. Almost nobody talks about it.

This post walks through a complete working example. End to end, two hundred lines of TypeScript.

## Why function calling matters

Without it, your LLM is a closed system. It only knows what's in its training data. With it, the LLM becomes a planner that calls real APIs, queries databases, runs calculations, hits your code. That's the difference between "interesting demo" and "production-grade agent."

The trick: the LLM doesn't actually call your function. It returns a structured request, and your code decides whether to execute it. Always.

## Which Ollama models support it

As of 2026:

- `qwen2.5:7b` and larger — strong support
- `llama3.1:8b` and larger — strong support
- `mistral-nemo` — strong support
- `qwen2.5-coder:7b` — works for technical functions
- `llama3.2:3b` — limited, expect quirks

Pull the model:

```bash
ollama pull qwen2.5:7b
```

## The minimum example

Define a tool. The schema follows the JSON Schema format the OpenAI API uses, so any existing tool you have works without translation.

```typescript
const tools = [
  {
    type: "function",
    function: {
      name: "get_weather",
      description: "Get the current weather for a city",
      parameters: {
        type: "object",
        properties: {
          city: { type: "string", description: "City name" },
          unit: {
            type: "string",
            enum: ["celsius", "fahrenheit"],
            description: "Temperature unit",
          },
        },
        required: ["city"],
      },
    },
  },
];
```

Call Ollama with the tools attached:

```typescript
const response = await fetch("http://localhost:11434/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5:7b",
    messages: [{ role: "user", content: "What's the weather in Bogotá?" }],
    tools,
    tool_choice: "auto",
  }),
});

const json = await response.json();
const message = json.choices[0].message;
console.log(message.tool_calls);
```

The response looks like this:

```json
{
  "tool_calls": [
    {
      "id": "call_1",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"city\":\"Bogotá\",\"unit\":\"celsius\"}"
      }
    }
  ]
}
```

The model didn't fabricate a temperature. It told you exactly which function to call and with what arguments.

## Closing the loop

Now your code executes the function and feeds the result back to the model so it can produce a natural-language answer.

```typescript
async function getWeather(city: string, unit: string) {
  // Call your real weather API here. Returning a stub for the example.
  return { city, temperature: 19, unit, conditions: "partly cloudy" };
}

const toolCall = message.tool_calls[0];
const args = JSON.parse(toolCall.function.arguments);
const result = await getWeather(args.city, args.unit ?? "celsius");

// Send the result back to the model
const final = await fetch("http://localhost:11434/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5:7b",
    messages: [
      { role: "user", content: "What's the weather in Bogotá?" },
      message,
      {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      },
    ],
  }),
});

const finalJson = await final.json();
console.log(finalJson.choices[0].message.content);
// "The weather in Bogotá is currently 19°C and partly cloudy."
```

Two round trips, total. Local. Free.

## Multiple tools, one prompt

Real agents use several tools. Define them all in the array; the model picks which to call.

```typescript
const tools = [
  { type: "function", function: { name: "get_weather", ... } },
  { type: "function", function: { name: "search_web", ... } },
  { type: "function", function: { name: "send_email", ... } },
  { type: "function", function: { name: "query_database", ... } },
];
```

For "Email my team the weather forecast for tomorrow", the model will chain `get_weather` → `send_email` automatically. You get back two tool calls in the same response. Execute both, return the results, and the model produces the final summary.

## Things that break, and how to handle them

**The model invents argument values.** Smaller models (3B and below) sometimes hallucinate fields. Defend against this with strict validation. I use Zod:

```typescript
import { z } from "zod";

const WeatherArgs = z.object({
  city: z.string(),
  unit: z.enum(["celsius", "fahrenheit"]).default("celsius"),
});

const args = WeatherArgs.parse(JSON.parse(toolCall.function.arguments));
```

If parse throws, return the error to the model and let it retry. Surprisingly, it usually fixes itself on the second pass.

**The model ignores the tool when it shouldn't.** Some questions get a chat answer instead of a tool call ("What's the weather like?" without a city). Reword your prompt: "If the user asks about weather, always call get_weather. Ask the user for missing parameters before calling." Models follow this consistently.

**The model calls a tool when it shouldn't.** Less common but it happens. Add to the system prompt: "Only call a function if the user is asking for live data. For general questions, answer from your knowledge."

## What this unlocks

You now have a local agent loop. The same pattern scales to:

- File system tools — let the LLM read and write files in a sandbox.
- Shell tools — execute commands and feed back the output.
- Database tools — query and update your app's data.
- API tools — wrap any REST endpoint as a function.

The LLM becomes the planner. Your code is the executor. Local LLMs are now legitimately useful for agent workflows, not just chat.

Next post in the series: building a local-only RAG system with Ollama, ChromaDB, and TypeScript. We'll combine retrieval with the function calling pattern from this post.
