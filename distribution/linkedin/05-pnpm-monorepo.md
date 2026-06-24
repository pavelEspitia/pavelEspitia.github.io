I keep my CLI and my web app in the same repo and share code between them without publishing anything to npm. The thing that makes that clean is pnpm workspaces.

I wrote down how I structure a TypeScript monorepo, the layout I landed on after a few rounds of getting it wrong, shared packages, build order, the tsconfig setup that keeps types honest across the whole thing.

If your repo is turning into a pile of copy-pasted utils, this is the fix.

Link in the comments.
