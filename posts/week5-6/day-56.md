---
title: "Shipping Four Products Solo: What a Year of Building in Public Taught Me"
tags: ["career", "productivity", "webdev", "ai"]
publish: false
---

Over the past year I shipped four things mostly solo: spectr-ai (an AI smart-contract auditor), Scry (chat with any EVM contract), Argus (a transaction-firewall extension), and Lomi (a multi-tenant SaaS). They span security, Web3, browser extensions, and B2B SaaS. Building that many different things alone taught me lessons that no single project would have. Here are the ones that actually changed how I work.

## Lesson 1: the scariest part is rarely the part you think

For every one of these, I budgeted my fear for the technically hard part. The AI analysis in spectr-ai. The bytecode reconstruction in Scry. The dual-scope RLS in Lomi. Those were hard, but they were *knowable* hard, the kind you can grind through.

The parts that actually threatened to sink each project were the boring ones at the edges. The Chrome Web Store review for Argus, not the firewall logic. The proxy resolution in Scry, not the chat. The deployment and auth for spectr-ai, which are still the things blocking it, not the auditing engine that works fine. The lesson: the moat is usually the unglamorous integration work, and I consistently under-budgeted for it.

## Lesson 2: AI changed the economics of solo building, but not the way people say

The loud claim is "AI lets one person build a company." The quieter truth I lived is more specific: AI collapsed the cost of the *first 80%* of every feature, and that 80% is exactly the part that used to make solo work feel impossible.

I can scaffold a feature, draft the tests, and get a working first pass faster than I could have written the boilerplate alone. What AI did *not* collapse is the last 20%: the edge cases, the security review, the "why does this break under a flaky connection" debugging. That part is still me, still slow, still where the real work is. So AI did not make me a team. It made the grunt work cheap enough that I could afford to ship four things instead of one.

## Lesson 3: a renamed product is not a wasted product

AbiLens became Scry. The repo-malware-scanner became Argus Lens. Early names were placeholders, and I used to feel like renaming meant I had wasted the original effort. I was wrong. The rename is a signal that the product got clear enough to deserve a real identity. The code did not change when the name did. What changed was that I finally understood what I had built well enough to name it properly. That clarity is progress, not waste.

## Lesson 4: finish the functionality before the UI, every time

The temptation, especially solo, is to make it look good early because a pretty screenshot feels like progress. I learned to resist this. A beautiful UI over half-working functionality is a trap: you have to redo the UI when the functionality forces a different shape, and you have fooled yourself into thinking you are further along than you are.

For every product, the rule became: every feature gets its logic *and* its tests done before any polish. I do not claim something works because a curl succeeded or the types compiled. It works when there is a test that would fail if it broke. Then, and only then, do I make it pretty. This single discipline saved me more rework than any framework choice.

## Lesson 5: share the work, even when it is rough

Building in public meant writing about each of these as I went, including the parts that were not working. The instinct is to wait until something is impressive. The payoff came from the opposite: writing about the KelpDAO hack, about a failed approach, about a bug I caught in my own threat model, taught me more than shipping silently would have, and it built an audience that cared about the process, not just the launch.

The audience for "here is exactly how I resolved a proxy contract" is small but it is the right people. They are the ones who become users, collaborators, and the source of the next idea.

## What I would tell someone starting

If you are about to build something solo:

1. Budget your time for the boring integration edges, not the exciting core. The edges will surprise you.
2. Use AI to make the first 80% of every feature cheap, and accept that the last 20% is still your slow, careful work.
3. Ship functionality and tests before polish. Always. No exceptions.
4. Write about it as you go, rough parts included. The teaching is half the learning.

Four products in a year sounds like a lot until you realize most of them are not "done." spectr-ai still needs deploy and auth. That is fine. Shipping is a verb, not a state, and doing it four times across four very different domains taught me more than perfecting one ever would have.
