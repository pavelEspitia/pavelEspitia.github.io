---
title: "Writing Evals for an LLM Security Tool: How I Know It Didn't Get Worse"
tags: ["ai", "security", "testing", "typescript"]
publish: false
---

Every time a new model ships, I face the same question for spectr-ai: does my contract auditor get better or worse on the new model? "Vibes" is not an answer when the tool tells people whether their code is safe. So I built evals. Here is how I test an LLM that produces fuzzy output, and why a handful of labeled examples beats a gut feeling every time.

## The problem with testing LLM output

Unit tests assume deterministic output. LLM output is not deterministic, and even when it is correct it phrases things differently each run. You cannot assert `output === "reentrancy on line 12"`. The model might say "the withdraw function is vulnerable to reentrancy" or "external call before state update in withdraw()."

So I do not test the text. I test the *finding*. Did the model identify the vulnerability class on the right function? That is a yes/no I can check, and it survives rephrasing.

## The eval set

I built a directory of contracts where I know the ground truth, because I planted it or verified it by hand:

```
evals/
  cases/
    reentrancy-classic.sol        → expect: reentrancy in withdraw
    access-control-missing.sol    → expect: missing onlyOwner on setFee
    safe-checks-effects.sol       → expect: NO findings (clean contract)
    integer-edge.sol              → expect: division by zero in average
  expected.json
```

`expected.json` is the labeled ground truth:

```json
{
  "reentrancy-classic.sol": [{ "class": "reentrancy", "function": "withdraw" }],
  "access-control-missing.sol": [{ "class": "access-control", "function": "setFee" }],
  "safe-checks-effects.sol": [],
  "integer-edge.sol": [{ "class": "division-by-zero", "function": "average" }]
}
```

The clean contract is the most important case. A tool that flags everything has perfect recall and is useless. I need to know it stays quiet when the code is safe.

## Scoring with precision and recall, not accuracy

I score each run on two numbers:

- **Recall**: of the real vulnerabilities, how many did the model find? Missing a bug is the dangerous failure for a security tool.
- **Precision**: of the things the model flagged, how many were real? Crying wolf trains users to ignore the tool.

```typescript
function score(found: Finding[], expected: Finding[]) {
  const match = (a: Finding, b: Finding) =>
    a.class === b.class && a.function === b.function;

  const truePositives = expected.filter((e) => found.some((f) => match(f, e)));
  const falsePositives = found.filter((f) => !expected.some((e) => match(e, f)));

  const recall = expected.length === 0 ? 1 : truePositives.length / expected.length;
  const precision = found.length === 0 ? 1 : truePositives.length / found.length;

  return { recall, precision };
}
```

I aggregate across all cases and report the mean. One number per model, comparable across runs.

## The runner

```typescript
import fs from "node:fs/promises";

async function runEvals(model: string) {
  const expected = JSON.parse(await fs.readFile("evals/expected.json", "utf8"));
  const scores = [];

  for (const [file, truth] of Object.entries(expected)) {
    const source = await fs.readFile(`evals/cases/${file}`, "utf8");
    const found = await analyze(source, model); // your auditor call
    scores.push(score(found, truth as Finding[]));
  }

  const recall = mean(scores.map((s) => s.recall));
  const precision = mean(scores.map((s) => s.precision));
  console.log(`${model}: recall=${recall.toFixed(2)} precision=${precision.toFixed(2)}`);
}
```

Now when Opus 4.8 or Fable 5 lands, I run the same suite against the new model string and compare. No vibes. Two numbers.

## What the evals actually caught

The eval set has earned its keep more than once. When I tested a newer model, recall *dropped* on a case I expected it to nail. The model had found the bug but declined to report it because my prompt said "only report high-confidence issues." The newer model followed that instruction more literally than the old one did. The fix was a prompt change, not a model rollback, and I only knew to look because the number moved.

That is the real value. The eval does not just tell me a model is worse. It tells me *where*, so I can find out whether the cause is the model or my own prompt.

## Start smaller than you think

You do not need a thousand cases. I started with eight and it was already enough to catch a regression. Label what you have, score precision and recall, run it on every model change. The discipline of having ground truth at all is most of the win. The size of the set is a refinement you add later, when eight cases stop surprising you.
