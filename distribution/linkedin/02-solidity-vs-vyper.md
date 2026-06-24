Most Solidity devs never touch Vyper, and that's fine, but the security tradeoffs between the two are worth understanding even if you stay on Solidity.

I've spent the last years auditing contracts and getting them audit-ready, and the language choice changes the kind of bugs you tend to ship. Vyper drops a lot of footguns on purpose, Solidity gives you more rope, both matter depending on what you're building.

I broke down the differences every auditor should know, with the actual attack surface in mind, not just syntax.

Link in the comments.
