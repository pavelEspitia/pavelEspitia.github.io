---
title: "Vyper for Solidity Developers: The Security Tradeoffs Nobody Explains"
tags: ["security", "blockchain", "solidity", "tutorial"]
publish: false
---

I audit both Solidity and Vyper, and developers coming from Solidity often assume Vyper is just "Python-flavored Solidity." It is not. Vyper makes deliberate language-design choices that remove entire bug classes by making them impossible to write, and it removes some features you might miss. Here is what actually changes for security when you move between them.

## Vyper's thesis: less power, fewer footguns

Solidity is a powerful, flexible language, and flexibility is where bugs live. Vyper's entire design philosophy is the opposite: be deliberately less expressive so that dangerous patterns are not just discouraged but unrepresentable. You cannot misuse a feature that does not exist.

That tradeoff is the whole story. Vyper gives up power to take away footguns. Whether that is good depends on what you are building, but for a developer it is important to know *which* footguns it removes, because it changes what you have to check.

## What Vyper removes, and the bugs that go with it

**No inheritance.** Solidity's inheritance, especially multiple inheritance with the C3 linearization, is a common source of confusion: which function runs, in what order, with which storage layout. Vyper has no inheritance. Every contract is flat and self-contained. That kills a class of "I did not realize the parent overrode this" bugs, at the cost of code reuse.

**No function overloading.** In Solidity you can have two functions with the same name and different parameters, and it is not always obvious which one a call resolves to. Vyper forbids it. One name, one function. The bug where you call the wrong overload simply cannot happen.

**No modifiers.** This one surprises people. Solidity modifiers (`onlyOwner`) are convenient but they hide control flow: the check is defined elsewhere and you have to remember it is applied. Vyper makes you write the check inline, in the function body, where you can see it:

```python
# Vyper: the access check is right there in the body, not hidden in a modifier
@external
def set_fee(new_fee: uint256):
    assert msg.sender == self.owner, "not owner"
    self.fee = new_fee
```

You lose DRY-ness. You gain a contract where the access control for a function is always visible at the point of the function, which is genuinely easier to audit. No hunting for what `onlyOwner` actually does.

**Bounds-checked everything, no inline assembly by default.** Vyper checks array bounds and does not casually drop you into raw assembly. Solidity lets you write `assembly { ... }` blocks that bypass all the safety, which is powerful and dangerous. Vyper's resistance to assembly removes a whole category of "the assembly block had a bug the high-level checks would have caught."

## What you give up

The flip side is real. No inheritance means more duplication or more separate contracts. No modifiers means repeating access checks. Limited expressiveness means some patterns that are clean in Solidity are awkward or impossible in Vyper. For complex protocols with lots of shared logic, the lack of inheritance can be genuinely painful.

And Vyper is not magic. It has had its own compiler bugs over the years, some serious. A language that prevents source-level footguns can still have a compiler that miscompiles. "Vyper, therefore safe" is as wrong as "audited, therefore safe."

## What changes in how I audit each

When I review Solidity, I spend real time on inheritance order, modifier definitions, and any assembly. Those are the language-specific risk areas. When I review Vyper, those concerns largely evaporate, and I redirect that attention to the logic and the economics, because the language has already foreclosed the structural footguns.

But the bug classes that are *not* about language expressiveness do not care which language you used:

- Reentrancy is possible in both (though Vyper has a built-in `@nonreentrant` decorator that is easy to apply).
- Oracle manipulation is a logic and economics problem, identical in both.
- Access control gaps happen in both, just expressed differently (a missing inline `assert` in Vyper, a missing modifier in Solidity).
- Signature replay, integer edge cases, and bad math are language-agnostic.

So Vyper removes the *structural* footguns and leaves the *logical* ones entirely intact. A Vyper contract can still be drained by a flash-loan oracle attack. The language does not know what your price feed is.

## The honest summary

Vyper is a reasonable choice when you want the language to prevent classes of mistakes and you can live with less code reuse. It genuinely removes inheritance bugs, overloading ambiguity, hidden modifier control flow, and casual assembly footguns. It does nothing for the logic and economic bugs that drain the biggest protocols, because those live above the language.

For a Solidity developer, the move to Vyper is not "easier" or "safer" in some blanket sense. It is a different distribution of risk: fewer structural traps, the same logical ones, and a smaller toolbox. Know which bugs the language took off the table, and keep auditing hard for the ones it left.
