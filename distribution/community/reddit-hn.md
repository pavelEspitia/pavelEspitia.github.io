# Community copy (Reddit / Hacker News)

These channels penalize copy-paste link drops and detect blog spam fast. Lead
with value, post the link plainly (no "link in comments" games), and reply to
comments. Post 1 per week, not all at once, space them across subreddits.

Rule of thumb: would this post be useful even if nobody clicked the link? If no,
rewrite it.

---

## Run LLMs Locally with Ollama → r/LocalLLaMA, r/ollama

**Title:** A from-scratch guide to running LLMs locally with Ollama, picking a model that fits your actual RAM

**Body:**
I kept seeing "just run Ollama" with no guidance on which model fits which machine, so I wrote the guide I wish I'd had. Covers install, picking a model by RAM budget, and the gotchas on a normal laptop (no 4090). No API keys, no monthly bill.

Happy to answer setup questions in the thread. Full write-up: <URL>

---

## Function Calling with Ollama → r/LocalLLaMA + Show HN

**Title (Reddit):** Wiring real tools to a local LLM with Ollama function calling (TypeScript)

**Title (HN):** Show HN: Function calling with local LLMs via Ollama

**Body:**
Most Ollama tutorials stop at chat completion. Ollama supports native function calling for compatible models, so the model can actually call your code instead of hallucinating the answer. I wrote a TypeScript walkthrough of the loop I use in my own projects. Feedback welcome, especially on models that handle multi-tool calls well. <URL>

---

## Scanning npm Packages for Malware → r/netsec + Show HN

**Title (Reddit):** Static-scanning npm packages for build-time malware before install, without running them

**Title (HN):** Show HN: Scan an npm package for malware before you install it

**Body:**
A fake job-interview repo recently tried to steal my keys by hiding code in the build tooling. So I looked into catching this statically: build-time code execution, deps shipped in the tarball but missing from the lockfile, obfuscation, all without cloning or installing. Write-up of the approach: <URL>

This is the Contagious-Interview pattern, so if you take interviews with "take-home" repos, worth a read.

---

## Solidity vs Vyper Security → r/ethdev

**Title:** The security tradeoffs between Solidity and Vyper, from an auditor's view

**Body:**
I audit contracts and get them audit-ready, and the language choice quietly changes which bugs you tend to ship. Vyper removes footguns on purpose, Solidity hands you more rope. Wrote down the differences that actually matter for attack surface, not just syntax. Curious how others here weigh the tradeoff. <URL>
