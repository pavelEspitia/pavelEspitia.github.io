---
title: "Run Qwen Coder & DeepSeek Locally: The 2026 Free AI Pair-Programmer Setup"
tags: ["ai","ollama","productivity","tutorial"]
publish: false
---

You're paying $10 to $20 a month for Copilot. You don't have to. A 2024-era laptop can run a coding model good enough for autocomplete, refactors, and "explain this function" entirely offline. No API key, no telemetry, no per-token bill. Here's the exact 2026 setup I run on a 16GB machine.

## Why local in 2026

Two years ago, local coding models were a toy. The autocomplete was slow and the suggestions were noise. That changed. `qwen2.5-coder` and `deepseek-coder-v2` are genuinely useful now, and the tooling caught up: Ollama serves them, Continue.dev wires them into your editor, and the whole thing runs on hardware you already own.

The pitch is simple:

- Free. No subscription, no usage caps.
- Private. Your proprietary code never leaves the machine. This matters if you work on smart contracts or anything under NDA.
- Offline. Works on a plane, in a basement, behind a corporate firewall.

The tradeoff is quality and latency. We'll be honest about both.

## Pick a model (and match it to your RAM)

This is the decision that makes or breaks the experience. Pick a model your machine can actually hold in memory, or it spills to disk and crawls.

```bash
# Fast, fits anywhere (8GB+)
ollama pull qwen2.5-coder:1.5b    # ~1.0GB
ollama pull qwen2.5-coder:3b      # ~1.9GB

# The sweet spot for most laptops (16GB)
ollama pull qwen2.5-coder:7b      # ~4.7GB

# Quality tier, needs headroom (32GB+ comfortable)
ollama pull deepseek-coder-v2     # ~8.9GB (16b MoE)
ollama pull qwen2.5-coder:14b     # ~9.0GB
ollama pull qwen2.5-coder:32b     # ~20GB
```

Rough rule: the model file size is the floor, then add a few GB for context and the OS. A 4.7GB model on a 16GB machine is comfortable. A 20GB model on the same machine is not.

| Model | Size | RAM I'd want | Use it for |
|-------|------|-------------|-----------|
| `qwen2.5-coder:1.5b` | 1.0GB | 8GB | Autocomplete, fast iteration |
| `qwen2.5-coder:7b` | 4.7GB | 16GB | Daily driver: chat, refactors, explain |
| `deepseek-coder-v2` | 8.9GB | 32GB | Harder reasoning, multi-file context |
| `qwen2.5-coder:32b` | 20GB | 64GB | Near-cloud quality, if you have the RAM |

`deepseek-coder-v2` is a 16b mixture-of-experts model, so it punches above what its file size suggests, only a couple billion parameters are active per token. It's the one I reach for when `qwen2.5-coder:7b` gives a shallow answer.

A note on quantization: those file sizes are the default 4-bit quants Ollama ships. They're the right call for a laptop. You can pull a higher-precision tag like `qwen2.5-coder:7b-instruct-q8_0` for slightly better output, but it roughly doubles the memory and the speed cost, and on everyday coding tasks I can't tell the difference. Start with the defaults.

My actual setup on 16GB: `qwen2.5-coder:1.5b` for inline autocomplete (it has to be fast or it's useless), `qwen2.5-coder:7b` for the chat sidebar where I can wait two seconds. I keep `deepseek-coder-v2` pulled but unloaded for the occasional gnarly problem, and let Ollama swap it in on demand.

## Install and run Ollama

```bash
# Linux / WSL
curl -fsSL https://ollama.com/install.sh | sh

# macOS
brew install ollama

# Windows: download from https://ollama.com/download
```

Start the server. It listens on `localhost:11434`:

```bash
ollama serve
```

Confirm it's alive and a model responds:

```bash
ollama run qwen2.5-coder:7b "Write a TypeScript debounce function"
```

If that prints code, you have a working local LLM. Everything else is wiring.

## Wire it into your editor with Continue.dev

[Continue.dev](https://continue.dev) is the open-source extension that turns Ollama into an editor assistant. It does chat, inline edits (highlight code, Cmd/Ctrl+I, describe the change), and tab autocomplete. Install it from the VS Code or JetBrains marketplace, then point it at your local models.

Edit `~/.continue/config.yaml`:

```yaml
name: Local pair programmer
version: 1.0.0
schema: v1

models:
  - name: Qwen Coder 7B
    provider: ollama
    model: qwen2.5-coder:7b
    roles:
      - chat
      - edit
  - name: Qwen Coder 1.5B (autocomplete)
    provider: ollama
    model: qwen2.5-coder:1.5b
    roles:
      - autocomplete
```

Two models, two jobs. The 1.5b handles the tight feedback loop of tab autocomplete where every millisecond shows. The 7b handles chat and multi-line edits where you'll tolerate a short wait for a better answer.

Restart VS Code, open the Continue sidebar, and ask it something about the file you have open. It reads your editor context and answers against your actual code, locally.

If you'd rather skip Continue and use the official Copilot-style hook, recent VS Code versions let you add Ollama as a custom model provider in the chat panel pointing at `http://localhost:11434`. Continue is still the more flexible option for autocomplete tuning.

One thing worth knowing: autocomplete and chat use different prompt formats under the hood. Continue handles this for you when you assign the `autocomplete` role, picking the fill-in-the-middle template the Qwen Coder models were trained on. If your inline suggestions come out garbled, it's almost always because a chat-only model got assigned the autocomplete role. The `qwen2.5-coder` family supports fill-in-the-middle at every size, which is why I use it for both jobs.

## The 30-second sanity check with fetch

Before trusting any editor integration, hit the server directly. Ollama exposes an OpenAI-compatible endpoint, so this works with zero SDK:

```typescript
const response = await fetch("http://localhost:11434/v1/chat/completions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: "qwen2.5-coder:7b",
    messages: [
      { role: "system", content: "You are a senior TypeScript reviewer." },
      {
        role: "user",
        content: "Find the bug:\nfunction sum(a, b) { return a - b }",
      },
    ],
    temperature: 0,
    stream: false,
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

No API key. No account. If this returns "it subtracts instead of adds," your local pair programmer is online and you can build anything on top of it.

For a streaming UI (the token-by-token effect), flip `stream: true` and read the response body as a stream. Same endpoint shape as OpenAI, so any client library that targets OpenAI works by just changing the base URL.

## Latency: what to actually expect

Numbers depend entirely on your hardware, so here's what I see on my machine (16GB RAM, integrated GPU, WSL2 on Windows) rather than invented benchmarks:

- **First call after startup is slow.** The model loads into memory once. On `qwen2.5-coder:7b` that's a few seconds. After that it stays warm.
- **Autocomplete with `1.5b` feels instant enough** to leave on. That's the whole reason to use the small model for that role.
- **Chat with `7b`** starts streaming in roughly a second or two and reads at a comfortable pace. Long multi-file prompts are slower.
- **A real GPU changes everything.** On a machine with a discrete NVIDIA card, the same models run several times faster and the bigger models become practical. On pure CPU, stick to `1.5b` and `3b` or you'll be waiting.

Tip: keep `ollama serve` running in the background all day. Don't start and stop it per request, you pay the load cost every time.

## Performance tips

1. **One small model for autocomplete, one bigger for chat.** Don't make `deepseek-coder-v2` do tab completion, the latency kills the flow.
2. **Set `temperature: 0`** for code. You want deterministic, not creative.
3. **Match the model to RAM.** If Ollama is swapping to disk you'll feel it instantly. Drop a size.
4. **Trim the context window** if you don't need 32k tokens. Smaller context means less memory and faster responses. Set it in the model's Continue config or with a custom `Modelfile`.
5. **Warm the model on login.** A throwaway `ollama run qwen2.5-coder:7b ""` at startup preloads it so your first real prompt isn't the slow one.
6. **Validate any structured output.** Smaller models occasionally botch JSON. Parse with Zod and retry on failure.

## When local is good enough (and when it isn't)

I use local models for most of the day and reach for Claude only when the problem is genuinely hard. Here's the honest split:

| Task | Local (`7b` / `deepseek`) | Reach for cloud |
|------|---------------------------|-----------------|
| Inline autocomplete | Great | Overkill |
| "Explain this function" | Great | No need |
| Boilerplate, tests, docstrings | Great | No need |
| Refactor within one file | Good | Marginal gain |
| Multi-file architecture reasoning | Hit or miss | Better |
| Subtle security review | Use as first pass | Better |
| Latest framework APIs (2026) | Stale | Better |

The cloud still wins on hard reasoning and on knowledge of the newest APIs. But for the volume of small, repetitive coding questions that make up most of a day, local is not "good enough as a fallback," it's just good enough. The quality gap that existed in 2024 has mostly closed for everyday work.

## What I run this on

When I built [spectr-ai](https://github.com/pavelEspitia/spectr-ai), my AI smart-contract auditor, I made the engine provider-agnostic for exactly this reason. The same analysis runs against Claude or against Ollama:

```bash
# Local, free, no API key, contract never leaves the machine
pnpm --filter @spectr-ai/engine dev -- \
  --model ollama:qwen2.5-coder:1.5b examples/vulnerable.sol
```

For smart-contract work, that "never leaves the machine" part isn't a nice-to-have. Audit clients don't want their unreleased code shipped to a third-party API. Local models make a privacy-preserving first pass possible, then I escalate the interesting findings to Claude.

Get `qwen2.5-coder:7b` running, wire up Continue, and use it for a week before you renew any Copilot subscription. The setup costs you twenty minutes and zero dollars a month after that.
