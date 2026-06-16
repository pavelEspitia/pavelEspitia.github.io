---
title: "Agentic Coding in Mid-2026: What Changed and How I Actually Use It"
tags: ["ai", "productivity", "career", "typescript"]
publish: false
---

The agentic coding landscape moved fast in the first half of 2026. Models that can run for hours, complete overnight refactors, and grade their own work against a goal. I have integrated these tools into my daily work across four projects, and the reality is more nuanced than either the hype or the backlash. Here is what genuinely changed and how I structure work to get value from it without getting burned.

## The capability that actually changed: long-horizon autonomy

The headline upgrade in the current frontier models is long-horizon agentic execution. Earlier models were great at a single edit and shaky over a multi-step task; they would lose the thread, re-derive things, or wander. The 2026 models hold a goal across many steps and finish complex work without constant correction. SWE-bench Verified scores climbed past 88% on the default Opus tier and to 95% on Fable 5, and those numbers reflect something real I feel in practice: I can hand off a bigger chunk of work and trust more of it to come back done.

The practical shift: the unit of delegation got larger. I used to delegate "write this function." Now I can delegate "refactor this module to use the new auth pattern, update the call sites, and fix the tests," and a capable model running at high effort will often complete it end to end.

## The technique that makes it work: full spec up front

The single biggest lever I found is counterintuitive if you are used to chatting back and forth. For long-horizon work, you get dramatically better results by stating the *full* task specification in one well-formed initial turn, rather than dribbling it out across many messages.

The current models are more autonomous and reason more after each turn. An underspecified prompt that you clarify progressively makes them less efficient and sometimes less accurate, because they spend reasoning on filling gaps you could have closed up front. A clear, complete goal in the first turn lets them plan once and execute. So I spend more time writing the kickoff and less time steering mid-flight.

```
Bad:  "refactor the auth module"  ... then 8 follow-up corrections
Good: "Refactor auth to use the session-token pattern in lib/session.ts.
       Update all call sites in app/api/. Preserve the existing public
       function signatures. Update the tests in auth.test.ts to match.
       Run the tests and fix any failures. Done = all tests green."
```

The second version runs to completion far more often.

## Effort matters more than it used to

On the current models, the `effort` setting is a real lever, not a minor tweak. For coding and agentic work, `xhigh` is the recommended setting and the Claude Code default. The non-obvious part, which I confirmed by measuring, is that higher effort on agentic tasks often *lowers* total cost: better planning means fewer wasted turns. I stopped treating high effort as expensive on multi-step work and started treating it as the efficient choice.

## What did not change: review is still mine

Here is the part the hype skips. The models got much better at *finding* bugs, with higher recall and precision than a year ago. But that improvement comes with a literal-instruction-following trait: if you tell a code-review agent "only report high-severity issues," it now obeys that filter strictly, and your measured bug-catching can actually *drop* even though the underlying capability rose. The model found the bugs and then declined to report the ones below your stated bar.

So I changed how I prompt review: report everything with a confidence and severity tag, and let me filter, rather than asking the model to filter for me. The coverage is the model's job; the prioritization is mine.

And regardless of how good the agent gets, the final review is still my responsibility. For security-sensitive code especially, I read every change. An agent that is right 95% of the time is wrong 1 in 20, and in smart-contract work, 1 in 20 can be a drained protocol.

## How I structure a day with agents

The workflow that emerged:

1. **Frame the task fully** before starting the agent. Write the spec like I would write a ticket for a careful colleague.
2. **Run at xhigh** for anything multi-step. Save lower effort for trivial edits.
3. **Let it run** without micromanaging. Interrupting mid-task to "help" usually hurts more than it helps now.
4. **Review the diff myself**, hard, especially anything touching money, keys, or access control.
5. **Keep tests as the contract.** The agent's job is "make the tests pass and add tests for the new behavior." Green tests are the handoff signal.

## The honest assessment

Agentic coding in mid-2026 is genuinely transformative for the *generation* and *grunt-work* parts of building software, and genuinely unchanged for the *judgment* parts. It made me faster at the 80% and left the critical 20% squarely with me. The developers getting the most out of it are not the ones who trust it blindly or refuse it entirely. They are the ones who learned to spec well, set effort right, and review like the agent might be wrong, because sometimes it is.
