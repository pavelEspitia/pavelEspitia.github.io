---
title: "I Replaced My $20/mo AI Tools With Local Models: My Full Stack"
tags: ["ai","ollama","productivity","webdev"]
publish: false
---

I was paying $20/mo for Copilot and reaching for the Claude API on every side project. Then I added it up. Copilot, a code-review SaaS trial, the occasional ChatGPT Plus month: I was burning real money on tasks a 4GB model running on my own machine handles fine. So I tore the whole thing down and rebuilt it local-first. Here is the exact stack, what each piece replaced, and the parts where I still pay for cloud.

## The cost table

Here is what I was spending versus what I run now.

| Task | Cloud tool | Was paying | Local replacement | Now |
|------|-----------|-----------|-------------------|-----|
| Autocomplete + inline chat | GitHub Copilot | $10/mo | `qwen2.5-coder:7b` via Continue | $0 |
| Code review | a review SaaS | ~$15/mo | local review prompt + qwen | $0 |
| Commit messages | Copilot / Cursor | bundled | `qwen2.5-coder:1.5b` git hook | $0 |
| Q&A over my own docs | ChatGPT Plus | $20/mo | Ollama + local RAG | $0 |
| Hard reasoning / shipping | Claude API | pay per token | still Claude | pay per token |

The recurring subscriptions went from roughly $45/mo to $0. I still pay Claude per token, but only for the work that actually needs it, and that bill is now a few dollars a month instead of a flat fee I paid whether I used it or not.

## The hardware

None of this is exotic. I run it on a Windows laptop through WSL2: Ryzen 7, 32GB RAM, and an RTX with 8GB VRAM. The GPU matters more than anything else here. The `7b` models fit in 8GB of VRAM and respond fast enough to feel interactive. The `1.5b` models run fine on CPU alone if you do not have a GPU, which is why I lean on them for the background tasks.

If you only have CPU, everything below still works, you just live on the smaller models and accept that long prompts take longer. Be honest with yourself about this before you cancel a subscription.

## 1. Autocomplete and chat (replaces Copilot)

The autocomplete is the piece people doubt most, so I will start there. I use the Continue extension in VS Code pointed at Ollama. The config is plain JSON:

```json
{
  "models": [
    {
      "title": "qwen-chat",
      "provider": "ollama",
      "model": "qwen2.5-coder:7b"
    }
  ],
  "tabAutocompleteModel": {
    "title": "qwen-autocomplete",
    "provider": "ollama",
    "model": "qwen2.5-coder:1.5b"
  }
}
```

Two models on purpose. Autocomplete needs to be fast above all else, so it runs on `1.5b`, which returns a suggestion in well under a second on my GPU. Chat, where I want a real answer, runs on `7b`.

Is it as good as Copilot? No, and I will not pretend otherwise. Copilot's multi-line completions are smarter and its sense of your wider repo is better. But for finishing the line I am already typing, closing a loop, filling in an obvious object literal, the local model is good enough that I stopped noticing the difference within a week. The honest gap shows up on long, novel completions, which is exactly where I would rather think for myself anyway.

## 2. Local code review

I built a small review step into my own workflow rather than paying a SaaS to comment on diffs. It is a shell function that pipes a staged diff into Ollama with a focused prompt:

```bash
review() {
  git diff --staged | ollama run qwen2.5-coder:7b \
    "You are a senior reviewer. Point out bugs, missing error
     handling, and unsafe patterns in this diff. Be specific and
     terse. If it looks fine, say so. Diff follows:"
}
```

The trick that makes this useful is the same one I learned building spectr-ai: narrow the prompt. Asking a `7b` model to "review this code" gets you vague praise. Asking it specifically for bugs, missing error handling, and unsafe patterns gets you something I can act on. It catches the boring real stuff: an unawaited promise, a swallowed error, an off-by-one in a slice. It misses architectural problems and anything that needs understanding of the whole system. I treat it as a second pair of eyes that never gets tired, not as an approver.

## 3. Commit message generation

This one runs entirely in the background and I never think about it. A `prepare-commit-msg` hook feeds the staged diff to the small model:

```bash
#!/usr/bin/env bash
set -euo pipefail

diff=$(git diff --staged)
[ -z "$diff" ] && exit 0

msg=$(printf '%s' "$diff" | ollama run qwen2.5-coder:1.5b \
  "Write a concise git commit message in imperative mood, under
   72 chars for the subject. Output only the message, no quotes.")

printf '%s\n' "$msg" > "$1"
```

I use `1.5b` here deliberately. The task is constrained enough that the small model nails it, and speed matters when it sits between me and the commit. I still read and edit what it writes, but it gets the subject line 80% right and I tweak the rest. A flat subscription to do this would be absurd when a 1GB model does it for free in half a second.

## 4. Local RAG over my own docs

This is the one that quietly replaced my ChatGPT Plus habit. I kept pasting my own project READMEs and notes into a chat box to ask "how did I wire up the provider abstraction again?" Now I run a local retrieval setup: documents get embedded with `nomic-embed-text` through Ollama, the vectors live in a local store, and queries pull the relevant chunks before they hit `qwen2.5-coder:7b`.

```typescript
const embed = async (text: string): Promise<number[]> => {
  const res = await fetch("http://localhost:11434/api/embeddings", {
    method: "POST",
    body: JSON.stringify({ model: "nomic-embed-text", prompt: text }),
  });
  const data = await res.json();
  return data.embedding;
};
```

The whole thing is offline. My notes, my unreleased project code, my half-formed ideas never leave the machine. That privacy point is not a footnote for me. As someone who works on smart-contract security, I am not pasting client code or unpublished findings into a cloud box, and now I do not have to.

## 5. Where I still pay for Claude

Local-first does not mean local-only. I still reach for the Claude API in two situations, and I am specific about which.

First, hard reasoning. When I needed spectr-ai to reason about how three contracts interact to form an attack path, the local models fell apart, the same way I wrote about in my "what I learned" post. They confidently describe attack vectors that do not work. Claude is meaningfully better at multi-step reasoning that is not just pattern matching, so spectr-ai's deep audit mode defaults to Claude.

Second, production quality. Both spectr-ai and AbiLens ship with a provider flag. Development, demos, and privacy-sensitive runs go through Ollama with `--provider ollama`. When a user wants the best possible audit and is fine paying for it, it routes to Claude. The provider abstraction I built on day one makes that a one-line switch:

```typescript
const provider = createProvider(options.provider); // "ollama" | "claude"
```

So the rule is simple: local for everything I do all day, cloud for the rare task that needs a frontier model or for the output someone else relies on.

## The honest limitations

I would be lying if I sold this as free with no cost.

1. **Quality gap is real on hard tasks.** For pattern recognition, code completion, and summarizing, the gap is small. For novel reasoning and long-context work, Claude still wins clearly.
2. **Speed depends entirely on hardware.** On my GPU the `7b` models are interactive. On CPU only, a long prompt can take a minute or more. There is no free lunch here, you trade money for either hardware or patience.
3. **First call after idle is slow.** The model has to load into memory. Keep the Ollama server warm and this stops mattering.
4. **You own the plumbing now.** No vendor fixes your git hook or updates your model for you. That is the price of not paying the other price.

## What this actually bought me

The money is the smaller win. The bigger one is that my daily AI tooling now runs offline, costs nothing per use, and never sends my code anywhere. I stopped rationing API calls because each one felt like spending. I stopped worrying about what I paste into a chat box.

The setup is not magic and it is not as polished as the paid tools. But qwen2.5-coder on Ollama crossed the "good enough for real work" line for me, and the parts that have not crossed it, the hard reasoning, are exactly the parts I am happy to pay Claude for by the token instead of by the month.

Start with the small model and the commit hook. It is the lowest-risk way to feel whether local-first works for you before you cancel anything.
