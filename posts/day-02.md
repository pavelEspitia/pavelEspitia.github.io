How to Run LLMs Locally with Ollama — A Developer's Guide

You don't need an API key or a cloud subscription to use LLMs. Ollama lets you run models locally on your machine — completely free, completely private. Here's how to set it up and start building with it.

## What is Ollama?

Ollama is a tool that downloads, manages, and serves LLMs locally. It exposes an OpenAI-compatible API at `localhost:11434`, so any code that works with the OpenAI API works with Ollama — zero changes.

## Installation

```bash
# Linux / WSL
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Windows
# Download from https://ollama.com/download
```

Start the server:

```bash
ollama serve
```

## Pick a Model

```bash
# Code-focused (best for dev tools)
ollama pull qwen2.5-coder:7b      # 4.7GB, good balance
ollama pull qwen2.5-coder:1.5b    # 1.0GB, fast, good enough for many tasks
ollama pull deepseek-coder-v2      # 8.9GB, top quality

# General purpose
ollama pull llama3.1:8b            # 4.7GB, Meta's latest
ollama pull mistral:7b             # 4.1GB, fast and capable
```

My recommendation: start with `qwen2.5-coder:1.5b` for speed, upgrade to `7b` when you need quality.

## Your First API Call

Ollama serves an OpenAI-compatible endpoint. Here's a call with plain `fetch`:

```typescript
const response = await fetch("http://localhost:11434/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5-coder:7b",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Explain what a closure is in JavaScript." },
    ],
    temperature: 0,
    stream: false,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

That's it. No API key, no SDK, no account.

## Structured Output (JSON Mode)

The key to building real tools with LLMs is getting structured output. Tell the model to respond with JSON:

```typescript
const response = await fetch("http://localhost:11434/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5-coder:7b",
    messages: [
      {
        role: "system",
        content: `Respond with ONLY valid JSON matching this schema:
        { "summary": "string", "topics": ["string"], "difficulty": "beginner|intermediate|advanced" }`,
      },
      {
        role: "user",
        content: "Analyze this article topic: Building REST APIs with Express.js",
      },
    ],
    temperature: 0,
    stream: false,
  }),
});
```

Tip: always validate the response with Zod or a similar schema validator. Smaller models sometimes return invalid JSON.

## Building a Provider Abstraction

If you want your app to work with both Ollama (local) and Claude/OpenAI (cloud), create a simple interface:

```typescript
interface LlmProvider {
  chat(system: string, messages: Message[]): Promise<string>;
}

class OllamaProvider implements LlmProvider {
  constructor(private model: string) {}

  async chat(system: string, messages: Message[]): Promise<string> {
    const response = await fetch("http://localhost:11434/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0,
        stream: false,
      }),
    });
    const data = await response.json();
    return data.choices[0].message.content;
  }
}
```

Now your code doesn't care where the model runs. Swap `OllamaProvider` for `AnthropicProvider` with a flag.

## Performance Tips

1. **First call is slow** — the model loads into memory. Subsequent calls are fast.
2. **Keep the server running** — don't start/stop per request.
3. **Use smaller models for dev** — `1.5b` for iteration, `7b` for production quality.
4. **Set `temperature: 0`** for deterministic output (important for structured responses).
5. **Add a timeout** — local models on CPU can take minutes for long prompts.

## When to Use Local vs Cloud

| Use Case | Local (Ollama) | Cloud (Claude/GPT) |
|----------|---------------|-------------------|
| Development | Great | Expensive |
| Privacy-sensitive data | Required | Risky |
| Production quality | Good (7b+) | Best |
| Speed | Depends on hardware | Fast |
| Cost | Free | Per-token |

## What I Built With It

[spectr-ai](https://github.com/pavelEspitia/spectr-ai) — an AI smart contract auditor that works with both Claude and Ollama. The `--model ollama:qwen2.5-coder:1.5b` flag runs everything locally, free, no API key.

Local LLMs are good enough for real developer tools. The quality gap is closing fast.
