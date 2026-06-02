---
title: "How Much RAM Do You Really Need to Run LLMs Locally? 2026 Benchmarks"
tags: ["ai","ollama","hardware","beginners"]
publish: false
---

"Will it run on my machine?" is the first question everyone asks before pulling a model with Ollama. The honest answer is a formula, not a yes or no. Here's how to estimate memory before you download 9GB you can't fit, plus what to actually expect for speed on the hardware you already own.

## The Rule of Thumb

A model's memory footprint is roughly:

```
RAM = (parameters in billions) * (bytes per parameter) + overhead
```

Bytes per parameter depends on quantization (more on that below). For the common Q4 quantization, figure about 0.55 to 0.65 GB per billion parameters once you include the KV cache and runtime overhead. Ollama's default quants land here.

So a 7B model at Q4 needs roughly `7 * 0.6 ≈ 4.2GB`, and in practice Ollama reports `qwen2.5-coder:7b` at 4.7GB on disk, which is close to what it occupies in memory. The overhead grows with your context window: a long prompt fills the KV cache and adds anywhere from a few hundred MB to a couple of GB. Plan for headroom, not a tight fit.

## What Quantization Actually Does

Models are trained in 16-bit floats. Quantization shrinks each weight to fewer bits so the model fits in less memory. You trade a little quality for a lot of RAM.

| Quant | Bits/param | ~GB per 1B params | Quality |
|-------|-----------|-------------------|---------|
| FP16 | 16 | ~2.0 | Full, reference |
| Q8_0 | 8 | ~1.1 | Nearly lossless |
| Q5_K_M | ~5.5 | ~0.75 | Very good |
| Q4_K_M | ~4.5 | ~0.6 | Good (the sweet spot) |
| Q3_K_M | ~3.5 | ~0.5 | Noticeable degradation |
| Q2_K | ~2.5 | ~0.4 | Often too lossy to trust |

The `_K_M` suffix means "K-quant, medium": a smarter scheme that keeps the important weights at higher precision and squeezes the rest. `Q4_K_M` is the default for most Ollama models because it's the best balance: roughly a quarter of the FP16 size with quality most people can't distinguish in normal use.

My take: don't go below Q4 unless you're desperate for space. The jump from Q4 to Q3 buys you a little RAM and costs you real coherence, especially on code.

To pull a specific quant in Ollama:

```bash
ollama pull qwen2.5-coder:7b-instruct-q4_K_M
ollama pull qwen2.5-coder:7b-instruct-q8_0
```

## RAM vs VRAM: CPU vs GPU Inference

This is the part beginners miss. There are two kinds of memory that matter, and which one you have changes everything about speed.

- **RAM** is your system memory. If the model lives here, your CPU does the math. It works, it's universal, and it's slow.
- **VRAM** is memory on your GPU. If the whole model fits here, the GPU does the math, and it's 10x to 30x faster.

Ollama loads as much of the model as fits in VRAM and runs the rest on CPU. A model that's half in VRAM and half in RAM runs at roughly the speed of the slow half, so partial offload helps less than you'd hope. The goal is to fit the *entire* model in VRAM.

That's why a $300 used 12GB GPU often beats a $2000 laptop with 64GB of RAM for inference: the RAM is plenty, but without VRAM the CPU is the bottleneck.

Apple Silicon is the exception. Unified memory means the GPU and CPU share one fast pool, so an M-series Mac with 16GB or more punches well above a typical RAM-only PC.

## The Benchmark Table

These are representative figures from my own machines and what I see consistently reported, not lab results. Treat them as "what to expect," plus or minus a chunk depending on your exact CPU, RAM speed, and GPU. CPU numbers assume a recent multi-core desktop/laptop chip; GPU numbers assume a mid-range card (roughly an RTX 3060/4060 class, 8 to 12GB VRAM) with the model fully offloaded.

| Model | Params | Q4 size | RAM to run | CPU tok/s | Mid GPU tok/s |
|-------|--------|---------|------------|-----------|---------------|
| qwen2.5-coder:1.5b | 1.5B | ~1.0GB | 4GB+ | 15 to 30 | 80 to 130 |
| mistral:7b | 7B | ~4.1GB | 8GB+ | 5 to 9 | 45 to 70 |
| qwen2.5-coder:7b | 7B | ~4.7GB | 8GB+ | 5 to 9 | 45 to 70 |
| llama3.1:8b | 8B | ~4.7GB | 8GB+ | 4 to 8 | 40 to 65 |
| deepseek-coder-v2 | 16B (MoE) | ~8.9GB | 16GB+ | 8 to 14 | 50 to 80 |

A few notes that matter:

1. **Tokens/sec is your "feel."** Below ~5 tok/s a model feels painful for chat. Above ~20 it feels snappy. GPU turns "go make coffee" into "instant."
2. **`deepseek-coder-v2` is a mixture-of-experts model.** It's 16B total but only activates ~2.4B per token, so it's faster than its size suggests while still needing the full 8.9GB resident.
3. **The 1.5B model on CPU is genuinely usable.** That's the whole point of it. For autocomplete, quick summaries, and structured extraction, it's fast enough without a GPU.
4. **First call is always slow** because the model loads from disk into memory. Benchmark the second call.

## Recommendations by Machine Class

### 8GB laptop (no dedicated GPU)

You can run 7B models, but only just. The OS and browser already eat 3 to 4GB, so a 4.7GB model leaves you scraping. Realistically:

- Daily driver: `qwen2.5-coder:1.5b` (~1.0GB). Fast on CPU, leaves room for everything else.
- Occasional quality: `mistral:7b` or `qwen2.5-coder:7b`, but close your browser tabs first and expect 5 to 9 tok/s.
- Avoid anything 8B or larger. You'll swap to disk and it'll crawl.

Keep your context window modest. A 16K context fills the KV cache and can push you over the edge on 8GB.

### 16GB dev box (no GPU or weak iGPU)

This is the comfortable RAM-only tier and where most developers sit.

- Default: `qwen2.5-coder:7b` (~4.7GB). Plenty of headroom, good code quality.
- Reach model: `deepseek-coder-v2` (~8.9GB) fits with room to spare and runs respectably thanks to MoE.
- You can run a 7B model and still have your IDE, Docker, and browser open. That's the real win.

Speed is still CPU-bound here (single digits to low teens tok/s), so use the 7B for "thinking" tasks and the 1.5B for anything interactive.

### 24GB+ with a GPU

Now it's a different machine. If you have 8 to 12GB of VRAM, every model in the table above fits fully on the GPU and flies.

- Workhorse: `qwen2.5-coder:7b` fully offloaded, 45 to 70 tok/s. Feels like a hosted API.
- Quality: `deepseek-coder-v2` for harder code tasks, still fast.
- With 24GB of VRAM (a 3090/4090 class card) you can run 32B-class models at Q4 entirely on the GPU. That's the tier where local quality starts rivaling cloud for code.

Check what Ollama is actually doing:

```bash
ollama ps
```

The `PROCESSOR` column tells you the split. `100% GPU` is what you want. If it says `50%/50% CPU/GPU`, your model is too big for VRAM and you're leaving speed on the table. Drop to a smaller quant or a smaller model until it's fully on the GPU.

## A Quick Sizing Checklist

Before you pull anything:

1. **Total RAM minus 4GB** is roughly your model budget on a RAM-only machine.
2. **VRAM is the number that matters** if you have a GPU. Fit the whole model in it.
3. **Stick to Q4_K_M** unless you have a specific reason not to.
4. **Add headroom for context.** Long prompts cost real memory.
5. **Benchmark the second call**, never the first.

## The Takeaway

You need less RAM than you think and more VRAM than you have. A 16GB machine with no GPU runs 7B code models comfortably, which covers most real developer work. A cheap GPU with 8 to 12GB of VRAM matters more than doubling your system RAM, because it turns a tolerable tool into an instant one.

Start with `qwen2.5-coder:1.5b` to learn the workflow, move to `7b` when you want quality, and only chase bigger models once you've got the VRAM to fit them. Everything I build, including [spectr-ai](https://github.com/pavelEspitia/spectr-ai), runs fine on a 16GB box with the 7B model. Local is more capable than the hardware fear suggests.
