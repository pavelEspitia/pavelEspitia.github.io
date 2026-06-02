---
title: "The Auditor's AI Workflow: How I Use LLMs Without Trusting Them"
tags: ["ai","web3","security","career"]
publish: false
---

I use an LLM on every contract I review. I also assume it is lying to me until I prove otherwise.

That sounds contradictory, but it is the only way to get leverage out of AI without getting burned by it. An LLM will map a 2,000-line protocol faster than you can scroll it, and then it will confidently invent a CVE that does not exist, assign "Critical" to a non-issue, and miss the actual bug three functions down. The skill is not "use AI" or "do not use AI." The skill is running a workflow where every AI claim has to survive a verification step before it reaches your report.

Here is the exact loop I run, the prompts I use, and where I refuse to trust the model.

## The Loop, Top to Bottom

1. **Recon and triage with AI** to build a mental map of the contract.
2. **Targeted questions per vulnerability class**, one class at a time.
3. **Verify every finding manually plus with tooling** (Slither, Foundry) before believing it.
4. **Use AI to write PoC exploit tests** that either confirm or kill the finding.
5. **Guard against hallucinations and false confidence** at every step.

Steps 1, 2, and 4 are where AI earns its keep. Step 3 is where I trust nothing. Step 5 runs the whole time.

## Step 1: Recon and Triage

The first job is not finding bugs. It is understanding the contract well enough to know where bugs would live. AI is excellent at this because summarizing and mapping is exactly what it is good at, and a wrong summary is cheap to catch.

My opening prompt is deliberately boring:

```
You are reviewing a Solidity contract. Do NOT look for vulnerabilities yet.
Output only:
1. Every external/public function, its access control, and what state it mutates.
2. All privileged roles and what each can do.
3. Every external call and which contracts it touches.
4. Any assumptions the code makes about callers or token behavior.
Cite line numbers for each item. If you are unsure, say "unsure" instead of guessing.
```

That last line matters. Telling the model to mark uncertainty instead of filling gaps cuts the confident-nonsense rate noticeably. I get back a function-by-function map, an access-control table, and an external-call list. I read the contract alongside it and fix the map where the model is wrong. By the end I have a verified picture of the attack surface, and the AI did the tedious cataloging.

This is the one stage where I let AI move fast, because the output is structural, not a judgment call, and I am cross-checking it line by line anyway.

## Step 2: One Vulnerability Class at a Time

A general "find all the bugs" prompt produces a wall of low-signal output: ten findings, three real, four hallucinated, three padding. So I ask per class, with the role context I built in step 1.

```
Focus ONLY on reentrancy in this contract.
For each external call: state whether checks-effects-interactions is followed,
which state is read after the call, and whether a reentrant call could profit.
Reference the function map I gave you. If a function is safe, say so and why.
Do not report anything outside reentrancy.
```

Then I repeat for access control, oracle/price manipulation, decimal and rounding errors, unchecked returns, storage layout (for proxies), and business-logic invariants. Narrow scope does two things: it keeps the model from spraying half-baked findings across categories, and it makes each answer easy to verify because I know exactly what claim to check.

For business logic, the model cannot help unless I give it intent, so I do:

```
The intended behavior: only the timelock (0x...) may execute a passed proposal,
and only after a 48-hour delay. Does the code enforce both? Quote the lines that do.
```

If it cannot quote the lines, the invariant probably is not enforced, and now I have a lead.

## Step 3: Trust Nothing Until It Is Verified

This is the part people skip, and it is the part that makes the difference between an AI-assisted audit and a hallucinated one. Every finding from step 2 goes through the same gate before I write it down.

| AI claims | How I verify before believing it |
|-----------|----------------------------------|
| "Reentrancy in `withdraw`" | Read the function. Run Slither. Write a Foundry PoC that actually reenters. |
| "This violates EIP-XXXX" | Open the actual EIP. Models invent spec numbers and requirements constantly. |
| "Severity: Critical" | Re-derive severity myself from impact times likelihood. AI severity is noise. |
| "Vulnerable to CVE-2021-XXXXX" | Search the CVE. Smart-contract findings rarely map to CVEs; usually fabricated. |
| "No issues in this function" | Treat as unconfirmed, not as a clean bill. Absence of a finding is not proof. |

The fastest filter is the deterministic tooling. Slither and a compiler do not hallucinate. If the AI flags reentrancy and Slither's `reentrancy-eth` detector is silent, I do not discard either one. I dig into why they disagree, because one of them is wrong and I need to know which. Often the AI caught a cross-function path Slither missed, and sometimes the AI made it up. The disagreement itself is the signal.

The hard rule: **a finding is not real until I can point to the lines and explain the exploit without the AI in the room.** If I cannot re-explain it myself, I do not understand it, which means I cannot defend it to a client, which means it does not go in the report.

## Step 4: Make AI Write the PoC

Once a finding survives manual review, the cleanest way to confirm it is a test that exploits it. Writing PoCs by hand is slow, and this is another spot where AI is genuinely strong because a failing or passing test is self-verifying. The test either drains the funds or it does not.

```
Write a Foundry test that proves this exploit. Setup: deploy the contract,
fund it with 10 ether, attacker starts with 1 ether. The test must assert the
attacker's balance increases by at least 9 ether after the attack. Use a
reentrancy receiver contract. Only Foundry, no pseudocode.
```

Then I run it.

```bash
forge test --match-test testReentrancyExploit -vvv
```

If it passes, the vulnerability is real and I now have a reproducible PoC for the report. If it fails, one of two things is true: the exploit does not work (the AI finding was wrong, kill it) or my setup is off (fix it and rerun). Either way the test, not the model's prose, is the source of truth. A passing exploit test is worth more than ten paragraphs of confident explanation.

## Step 5: Guarding Against Hallucinations

Here is where AI lies to you, ranked by how often I see it:

1. **Invented severity and confidence.** "Critical" on a gas optimization. The fix is to ignore AI severity entirely and re-derive your own.
2. **Fabricated standards and CVEs.** Cited EIPs, SWC entries, and CVE numbers that do not exist or do not say what the model claims. Always open the source.
3. **Plausible-but-wrong exploit paths.** A reentrancy story that ignores a `nonReentrant` modifier two lines up. The PoC test kills these.
4. **Silent misses presented as completeness.** "I reviewed everything and found no other issues." It did not review everything. Coverage is your job.
5. **Anchoring.** Tell the model a function is vulnerable and it will find a way to agree. Ask neutrally: "is this safe or unsafe, and why," not "explain why this is vulnerable."

The structural defense is to never let free-form model text be the final artifact. This is exactly how I built spectr-ai: the LLM does not get to return prose that goes straight into a report. Its output is forced through a Zod schema (every finding must have a title, a severity from a fixed enum, a line reference, and a description), so a malformed or half-hallucinated response fails validation instead of silently corrupting the results. Then those findings sit next to deterministic Slither output, not in place of it. The AI gives reasoning and coverage; the static analyzer and the type-checked schema give you a floor of facts the model cannot wander away from.

That pairing is the whole philosophy in one sentence: **let the AI reason, but pin every claim to something deterministic.**

## The Trust-But-Verify Checklist

Before any AI-sourced finding goes in a report, it clears all of these:

- [ ] I read the flagged code myself and understand the claim.
- [ ] I can explain the exploit without the AI present.
- [ ] A deterministic tool (Slither, compiler, or my own reading) agrees, or I understand exactly why it disagrees.
- [ ] Any cited EIP, SWC, or CVE was opened and actually says what the model claimed.
- [ ] Severity was re-derived by me from impact times likelihood, not copied from the model.
- [ ] Where exploitable, a Foundry PoC test passes and proves it.

If a finding fails any box, it stays out until I close the gap.

## The Takeaway

AI does not make you a worse auditor by being wrong. It makes you a worse auditor when you let it be the last word. Used inside a verification loop, an LLM is the best junior analyst you will ever have: tireless at recon, fast at writing PoCs, fluent at explaining a pattern you half-remember. Used as an oracle, it is a confident liar that will put fabricated CVEs in your report.

The workflow is the entire value. Recon with it, question it one class at a time, verify everything against tooling and your own reading, make it write the PoC, and never trust a severity it assigned itself. Do that and AI is leverage. Skip it and AI is liability.

That verification-first design is what I am building into [spectr-ai](https://github.com/pavelEspitia/spectr-ai): LLM reasoning, forced through a typed schema, paired with deterministic static analysis, so the AI gets to think but never gets the last word. It is open source and runs with Claude or a local model via Ollama.
