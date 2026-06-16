---
title: "When Mythos Spooked the Security World: AI That Finds and Exploits Vulnerabilities"
tags: ["security", "ai", "career", "blockchain"]
publish: false
---

Earlier in 2026, before Fable 5 shipped to the public, Anthropic's Mythos-class models reportedly unsettled the cybersecurity world with a superhuman ability to find and exploit vulnerabilities. As someone whose job is finding vulnerabilities, I had complicated feelings about this. Here is what it means when AI gets genuinely good at offensive security, and why the response should be defensive adoption, not denial.

## What "good at finding vulnerabilities" actually means

There is a difference between a model that can explain a known vulnerability class and a model that can take an unfamiliar codebase and find the novel bug nobody flagged yet. The first is a study aid. The second is a capability that changes the balance between attackers and defenders.

The Mythos line crossed into the second category well enough that Anthropic kept the unrestricted version (Mythos 5) limited to a small group of cyberdefenders and infrastructure providers, while the public gets Fable 5, the same model with hard safeguards. Those safeguards specifically gate cybersecurity and biology, falling back to a less capable model for high-risk prompts. That product decision is itself the signal: the capability was real enough to wall off.

## The defender's dilemma

If a model can find exploitable bugs, that helps defenders and attackers equally. A defender runs it on their own code before shipping. An attacker runs it on everyone else's deployed code. The same capability, opposite intent.

The reports from this year bear this out: AI is lowering the bar for exploit discovery, and automated reconnaissance is increasingly scanning old and unverified smart contracts for weaknesses. The attackers are already using AI on the offensive side. They are not waiting for permission or worrying about safeguards.

This is the dilemma for anyone who ships code that holds value, and in Web3 every contract holds value: the attackers have AI that finds bugs, and pretending they do not is not a strategy. The only move is to find your own bugs first, with the same class of tool.

## Why the safeguards do not fully solve it

Anthropic's Fable 5 safeguards block high-risk cybersecurity prompts and fall back to a safer model. That is a responsible move for the public release. But it is a porous boundary for defenders. If I run a legitimate security analysis on my own contract and the prompt looks adversarial to a safeguard, I get a quietly downgraded answer. The safeguard cannot tell my defensive audit from an attacker's reconnaissance, because at the prompt level they can look identical.

So the public, safeguarded model is a real tool for defense but a blunted one, and the unrestricted capability sits with a small set of approved defenders. Meanwhile attackers, using whatever tooling they can get, are not constrained by these safeguards at all. The asymmetry is uncomfortable, and I do not think it is fully resolved.

## What this changes about my work

I do not get less careful because AI got good at finding bugs. I get more systematic, because the bar moved. Concretely:

- **I run AI analysis on my own attack surface first, aggressively.** If a model can find the bug, I want it to find mine before someone else's model finds it in production. Defense is now partly "race the attacker's tooling."
- **I treat unverified and old contracts as higher risk than I used to**, because they are exactly what automated attacker reconnaissance targets. Verification and freshness are now part of the threat model, not just hygiene.
- **I do not trust the AI's clean bill of health.** A model that can find bugs can also miss them, and a safeguarded model can silently downgrade on the prompts I care most about. The AI is a powerful pass, not the last word. I still review by hand.

## The honest reckoning for security careers

People ask whether AI finding vulnerabilities makes security work obsolete. It does the opposite. It raises the floor on what counts as a thorough review (you now have to assume the attacker ran a capable model on your code) and it raises the value of the judgment AI does not have: deciding what matters, understanding the business context, weighing the economic cost of an exploit, and catching the things a safeguarded model declined to surface.

The auditor who refuses to use these tools is auditing with one hand tied while attackers use both. The auditor who uses them well, on their own code, with full awareness of the limits and the silent fallbacks, is doing the only sensible thing: meeting an AI-equipped adversary with AI-equipped defense, and keeping the human judgment that neither side's model has.

Mythos spooked the security world for a good reason. The response is not fear. It is to pick up the same capability, point it at your own code first, and never stop reviewing what it tells you.
