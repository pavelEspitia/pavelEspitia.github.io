---
title: "Self-Hosted GitHub Copilot Alternative: Code with Ollama for Free"
tags: ["ai", "ollama", "productivity", "vscode"]
publish: true
---

# Self-Hosted GitHub Copilot Alternative: Code with Ollama for Free

GitHub Copilot is ten dollars a month and your code goes to a third party. Both are fine until they're not. If you write proprietary code, work in a regulated industry, or just don't want to ship every keystroke to Microsoft, there's a free, local alternative that runs entirely on your laptop.

This post walks through the setup. End to end, twenty minutes.

## The stack

- **Ollama** — the local model runner.
- **Continue.dev** — a VS Code extension that talks to Ollama.
- **A code-focused LLM** — `qwen2.5-coder:7b` for speed, `qwen2.5-coder:32b` for quality.

That's it. No API keys, no monthly bill, no telemetry.

## Why this actually works in 2026

Local code models have closed the gap. Qwen2.5-Coder 32B benchmarks within five points of Claude Sonnet on HumanEval. The 7B variant is fast enough to autocomplete in real time on a 16 GB MacBook M2. DeepSeek-Coder-V2 and CodeLlama 70B are also strong choices if you have more RAM.

The key shift: you no longer need a cloud GPU farm to get usable AI assistance.

## Install Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download the installer from ollama.com
```

Pull the code model:

```bash
ollama pull qwen2.5-coder:7b      # 4 GB, fast
ollama pull qwen2.5-coder:32b     # 19 GB, slower but smarter
```

Verify it's running:

```bash
ollama run qwen2.5-coder:7b "write a TypeScript debounce function"
```

It should respond in one to three seconds.

## Install Continue

In VS Code, install the extension `continue.continue`.

Open Continue's settings (`Cmd+L` on macOS, then click the gear icon) and edit your `~/.continue/config.json` to point at Ollama:

```json
{
  "models": [
    {
      "title": "Qwen 2.5 Coder 7B",
      "provider": "ollama",
      "model": "qwen2.5-coder:7b",
      "apiBase": "http://localhost:11434"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Tab Autocomplete",
    "provider": "ollama",
    "model": "qwen2.5-coder:7b",
    "apiBase": "http://localhost:11434"
  },
  "embeddingsProvider": {
    "provider": "ollama",
    "model": "nomic-embed-text"
  }
}
```

Pull the embedding model so codebase indexing works:

```bash
ollama pull nomic-embed-text
```

Reload VS Code. Open any TypeScript file and start typing. You should see grey ghost-text suggestions, just like Copilot.

## Test it like a real user

Hit `Cmd+I` and ask:

> Write a function that debounces a callback. Use TypeScript generics.

You should see a response in two to four seconds. The function should be correct on first attempt.

For inline edits, select code and hit `Cmd+I`:

> Refactor this to use early returns.

The diff appears inline. Accept or reject with one keystroke.

## Latency comparison

| Action | Cloud Copilot | Local Ollama (7B) | Local Ollama (32B) |
|---|---|---|---|
| Tab autocomplete | 200-400 ms | 300-600 ms | 1.5-3 s |
| Inline edit | 1-2 s | 2-4 s | 8-15 s |
| Multi-file refactor | 3-5 s | 5-10 s | 20-40 s |

The 7B model is the right default for most flows. Bring out the 32B model when you're doing architecture work or asking for explanations.

## What you actually give up

I don't want to oversell this. The 7B local model misses subtle bugs that Copilot's frontier model catches — null-check edge cases, Promise.all vs Promise.allSettled distinctions, that kind of thing. Multi-file context is also weaker. Continue indexes your repo locally, but it's not at the level of Copilot's whole-workspace awareness.

For senior engineers writing performance-sensitive code at the limit of the language, Copilot is still better. For everyone else doing 80 percent of normal day-to-day work, local Ollama is indistinguishable in quality and zero in cost.

## What you save

A hundred and twenty dollars a year, plus the value of your code never leaving your machine. If you ship in a regulated industry where data sovereignty matters — health, finance, defense, legal — this is the difference between "no AI assistance allowed" and "AI assistance with a full local audit trail." That trade rarely makes sense at the cost of a single subscription.

## What's next

If this works for you, the next post in this series goes deeper: comparing Ollama against LM Studio and Jan, the two other serious local AI runners. Different tradeoffs, different best-fits. Worth knowing before you commit a tool to your daily flow.

For now, you have a working local Copilot. Happy not-paying.
