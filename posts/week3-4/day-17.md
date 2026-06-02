---
title: "Building a Local AI Code Reviewer with Ollama That Catches Bugs Before Your Team"
tags: ["ai","ollama","typescript","devops"]
publish: false
---

Your teammates are busy. Your CI is green but shallow. And the bug you just staged is the kind a second pair of eyes would catch in five seconds. So let's build that second pair of eyes: a small TypeScript CLI that feeds your staged git diff to a local LLM and returns structured findings, before anyone else sees your code. No API key, no cloud, no leaking your private repo to a vendor.

## The plan

The whole tool is one loop:

1. Grab the staged diff with `git diff --cached`.
2. Send it to Ollama with a tight review prompt.
3. Ask for JSON, validate it with Zod.
4. Print findings, exit non-zero if anything is severe.
5. Wire it as a `pre-commit` hook.

Everything runs locally against `qwen2.5-coder:7b`. You'll need Ollama running (`ollama serve`) and the model pulled (`ollama pull qwen2.5-coder:7b`).

## Step 1: Get the staged diff

The reviewer should look at exactly what you're about to commit, nothing more. That's `--cached` (staged changes only):

```typescript
import { execSync } from "node:child_process";

function getStagedDiff(): string {
  return execSync("git diff --cached --no-color -U3", {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}
```

A few choices that matter:

- `--no-color` keeps ANSI escape codes out of the prompt.
- `-U3` gives three lines of context around each hunk. Enough for the model to reason, not so much that you blow the context window.
- `maxBuffer` bumps Node's default 1MB cap so big diffs don't throw.

If the diff is empty, there's nothing to review:

```typescript
const diff = getStagedDiff();
if (diff.trim().length === 0) {
  console.log("No staged changes. Stage something first with `git add`.");
  process.exit(0);
}
```

## Step 2: Craft the review prompt

This is where the quality lives. A vague prompt gives you vague, hallucinated nitpicks. Be specific about what counts as a finding, and what to ignore.

```typescript
const SYSTEM_PROMPT = `You are a senior code reviewer. You review git diffs for bugs only.

Focus on:
- Logic errors (off-by-one, inverted conditions, wrong operators)
- Null/undefined access and unhandled error cases
- Resource leaks (unclosed handles, missing awaits)
- Security issues (injection, hardcoded secrets, unsafe input)

Do NOT report:
- Style, formatting, or naming preferences
- Suggestions to add comments or tests
- Anything you are not confident is an actual bug

Lines starting with "+" are added. Lines starting with "-" are removed.
Only review added ("+") lines. Respond with ONLY valid JSON.`;
```

The "do NOT report" block is doing heavy lifting. Small models love to pad output with "consider adding a comment here." Telling them what to suppress is more effective than telling them what to find.

The instruction to only review `+` lines matters too. Without it, the model will happily flag a bug in code you just deleted, which is both useless and confusing. Diffs are a strange dialect to a model trained mostly on whole files, so being explicit about what the `+` and `-` prefixes mean pays off in fewer nonsense findings.

## Step 3: Ask for structured JSON

Ollama speaks the OpenAI-compatible API at `localhost:11434`. Spell out the exact schema in the prompt and set `temperature: 0` so the output is deterministic:

```typescript
const RESPONSE_SCHEMA = `Respond with this exact JSON shape:
{
  "findings": [
    {
      "severity": "high" | "medium" | "low",
      "file": "string",
      "line": "string (the code snippet or line reference)",
      "issue": "string (one sentence: what is wrong)",
      "fix": "string (one sentence: how to fix it)"
    }
  ]
}
If there are no bugs, return { "findings": [] }.`;

async function reviewDiff(diff: string, model: string): Promise<unknown> {
  const response = await fetch("http://localhost:11434/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n${RESPONSE_SCHEMA}` },
        { role: "user", content: `Review this diff:\n\n${diff}` },
      ],
      temperature: 0,
      response_format: { type: "json_object" },
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}. Is \`ollama serve\` running?`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}
```

`response_format: { type: "json_object" }` nudges Ollama into JSON mode, which cuts down on the "Here's your review:" preamble that breaks `JSON.parse`. It isn't a guarantee, though, which is why the next step exists.

## Step 4: Validate with Zod

Never trust raw model output. A 1.5b model will occasionally hand you a string where you expected an array, or invent a severity level. Parse it at the boundary and fail loudly if it's malformed:

```typescript
import { z } from "zod";

const FindingSchema = z.object({
  severity: z.enum(["high", "medium", "low"]),
  file: z.string(),
  line: z.string(),
  issue: z.string(),
  fix: z.string(),
});

const ReviewSchema = z.object({
  findings: z.array(FindingSchema),
});

type Review = z.infer<typeof ReviewSchema>;

function parseReview(raw: unknown): Review {
  const result = ReviewSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Model returned invalid review JSON:\n${result.error.message}`);
  }
  return result.data;
}
```

`safeParse` over `parse` so you can give a useful error instead of an unhandled throw. When this fires, it's almost always the model wandering off-schema, and the fix is usually a smaller diff or a bigger model.

## Step 5: Print the findings

Make the output scannable. A reviewer nobody reads is useless:

```typescript
function printReview(review: Review): number {
  if (review.findings.length === 0) {
    console.log("Local review passed. No bugs found.");
    return 0;
  }

  const icon = { high: "[HIGH]", medium: "[MED] ", low: "[LOW] " };
  let hasHigh = false;

  for (const f of review.findings) {
    if (f.severity === "high") hasHigh = true;
    console.log(`\n${icon[f.severity]} ${f.file}`);
    console.log(`  where: ${f.line}`);
    console.log(`  issue: ${f.issue}`);
    console.log(`  fix:   ${f.fix}`);
  }

  console.log(`\n${review.findings.length} finding(s).`);
  return hasHigh ? 1 : 0;
}
```

Notice the exit code: only `high` severity blocks the commit. Medium and low get printed as a heads-up but don't stand in your way. Tune that threshold to your team's tolerance.

## Wiring it all together

```typescript
async function main() {
  const model = process.argv[2] ?? "qwen2.5-coder:7b";
  const diff = getStagedDiff();

  if (diff.trim().length === 0) {
    console.log("No staged changes.");
    process.exit(0);
  }

  try {
    const raw = await reviewDiff(diff, model);
    const review = parseReview(raw);
    process.exit(printReview(review));
  } catch (err) {
    console.error(`Review failed: ${(err as Error).message}`);
    // Don't block commits on tooling failure. Warn and pass.
    process.exit(0);
  }
}

main();
```

The `catch` is deliberate: if Ollama is down or the JSON is garbage, you log it and let the commit through. A review tool that hard-blocks commits when it itself breaks is a tool people will rip out by Friday.

## Step 6: Make it a pre-commit hook

Build the CLI, then drop a hook into `.git/hooks/pre-commit`:

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "Running local AI review..."
node /path/to/review.js qwen2.5-coder:7b
```

```bash
chmod +x .git/hooks/pre-commit
```

For a hook the whole team shares, use [husky](https://typicode.github.io/husky) instead so it lives in the repo. Either way, every `git commit` now runs the diff past a local model first. Need to skip it for a quick WIP commit? `git commit --no-verify`.

One thing to watch: the first call after the model loads into memory is slow, often several seconds on CPU. That's Ollama paging the weights in, not your code being slow. Keep `ollama serve` running in the background and subsequent commits feel near-instant. If you commit rarely enough that the model unloads between commits, that cold start is the price you pay each time.

## Be honest about small local models

This is the part most tutorials skip. A local `qwen2.5-coder:7b` is not a staff engineer. Here's the realistic picture:

| Bug type                          | 1.5b      | 7b        | Notes                              |
|-----------------------------------|-----------|-----------|------------------------------------|
| Null/undefined access             | Decent    | Good      | The model's bread and butter       |
| Inverted conditions / wrong operator | Spotty | Decent    | Needs enough context (`-U3` helps) |
| Missing `await`                   | Decent    | Good      | Easy pattern to catch              |
| Subtle race conditions            | Misses    | Misses    | Needs cross-file context it lacks  |
| Logic spanning multiple files     | Misses    | Misses    | A diff is a keyhole, not the room  |
| False positives                   | Frequent  | Occasional | The main cost of running local     |

Two failure modes dominate: it invents bugs that aren't there (false positives), and it misses anything that requires understanding code outside the diff. Here's how to keep it useful anyway:

1. **`temperature: 0` always.** Deterministic output means the same diff gives the same review. You can't trust a reviewer that changes its mind on re-run.
2. **Scope the diff small.** Review per-commit, not per-branch. The smaller and more focused the diff, the sharper the model. A 2000-line diff gets you noise.
3. **Use `7b` for the hook, `1.5b` for fast local iteration.** `1.5b` is ~1GB and quick, but its false-positive rate makes it annoying as a gate. Save it for `--dry-run` style checks.
4. **Block on `high` only.** Let medium and low be advisory. This keeps the false-positive tax from blocking real work.
5. **Treat it as a first pass, not a replacement.** It catches the dumb stuff so your human reviewers can spend their attention on architecture and intent.

## Takeaway

A local AI reviewer won't replace your team, and it shouldn't try to. What it does well is catch the careless, three-in-the-afternoon bugs before they reach a pull request: the missing `await`, the `!` you meant to delete, the unhandled `null`. It runs free, it runs private, and it runs every time you commit.

I built the same Claude-plus-Ollama pattern at a larger scale in [spectr-ai](https://github.com/pavelEspitia/spectr-ai), an AI smart contract auditor where `--model ollama:qwen2.5-coder:1.5b` runs the entire audit locally with no API key. The diff-reviewer here is the same idea shrunk to fit in a git hook. Steal it, scope your diffs, and let the small model earn its keep.
