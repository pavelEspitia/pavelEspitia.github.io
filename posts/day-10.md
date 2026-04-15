# How I Structured a TypeScript Monorepo with pnpm Workspaces

When spectr-ai started as a single package, everything lived in one directory: the CLI engine, the web frontend, shared types, and configuration. It worked fine until it did not. The engine needed its own publish cycle. The web app had different build tooling. Shared types were copy-pasted between files. It was time for a monorepo.

This is the practical guide I wish I had. No theory — just the steps, the config files, and the problems I hit along the way.

## Why pnpm Workspaces

I chose pnpm over npm workspaces or Turborepo for three reasons: strict dependency isolation (packages cannot access undeclared dependencies), disk efficiency through content-addressable storage, and the `workspace:*` protocol that makes cross-package references explicit. Turborepo is great for build orchestration, but pnpm workspaces handle dependency management better out of the box.

## The Target Structure

Here is what spectr-ai's monorepo looks like after the migration:

```
spectr-ai/
  pnpm-workspace.yaml
  package.json
  tsconfig.base.json
  packages/
    engine/
      package.json
      tsconfig.json
      src/
    shared/
      package.json
      tsconfig.json
      src/
  apps/
    web/
      package.json
      tsconfig.json
      src/
```

Three workspace packages: `@spectr-ai/engine` (the CLI and analysis core), `@spectr-ai/shared` (types, constants, utilities), and the web app under `apps/web`.

## Step 1: pnpm-workspace.yaml

This file tells pnpm where your packages live. Create it at the repo root:

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

That is the entire file. Every directory matching these globs that contains a `package.json` becomes a workspace package.

## Step 2: Root package.json

The root `package.json` is not a publishable package. It holds shared dev dependencies and workspace-level scripts.

```json
{
  "name": "spectr-ai",
  "private": true,
  "scripts": {
    "build": "pnpm --filter './packages/**' build",
    "dev": "pnpm --filter @spectr-ai/web dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "5.7.3"
  }
}
```

Key details: `"private": true` prevents accidental publishing of the root. The `-r` flag runs a script recursively across all workspace packages. The `--filter` flag targets specific packages.

## Step 3: Package-Level package.json

Each package declares its own name, dependencies, and entry points. Here is the engine package:

```json
{
  "name": "@spectr-ai/engine",
  "version": "0.3.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./analyzers": {
      "import": "./dist/analyzers/index.js",
      "types": "./dist/analyzers/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc --build",
    "lint": "oxlint src/",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@spectr-ai/shared": "workspace:*"
  }
}
```

The `workspace:*` protocol is the critical piece. It tells pnpm to resolve `@spectr-ai/shared` from the local workspace instead of the registry. When you publish, pnpm automatically replaces `workspace:*` with the actual version number.

The `exports` field replaces the old `main`/`types` fields and gives you fine-grained control over what consumers can import. Without it, any file in `dist/` is importable — which leaks internal implementation details.

## Step 4: TypeScript Configuration

A base `tsconfig.base.json` at the root defines shared compiler options:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  }
}
```

Each package extends it and adds its own paths:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src"],
  "references": [
    { "path": "../shared" }
  ]
}
```

The `composite: true` and `references` fields enable TypeScript's project references. This gives you incremental builds: changing a file in `shared` only rebuilds `shared` and its dependents, not the entire repo.

## Step 5: Cross-Package Imports

With the setup above, importing from a sibling package looks like importing from any npm package:

```typescript
import { AuditResult, Severity } from "@spectr-ai/shared";
import { analyzeContract } from "@spectr-ai/engine/analyzers";
```

No relative paths crossing package boundaries. No path aliases that break at runtime. The `exports` field in each package's `package.json` controls what is importable.

## Step 6: CI with --filter

In CI, you do not want to rebuild and test everything when only one package changed. pnpm's `--filter` flag handles this:

```yaml
jobs:
  test-engine:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683  # v4.2.2
        with:
          persist-credentials: false
      - uses: pnpm/action-setup@a7487c7e89a18df4991f7f222e4898a00d66ddda  # v4.1.0
      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020  # v4.4.0
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @spectr-ai/engine build
      - run: pnpm --filter @spectr-ai/engine test
      - run: pnpm --filter @spectr-ai/engine typecheck
```

The `--filter` flag also resolves dependencies automatically. If `engine` depends on `shared`, running `pnpm --filter @spectr-ai/engine build` builds `shared` first.

For change-based filtering, you can use `--filter ...[origin/main]` to only run against packages that changed since the main branch:

```bash
pnpm --filter '...[origin/main]' test
```

## Problems I Hit

**Problem 1: Phantom dependencies.** A package imported `zod` without declaring it in its own `package.json`. It worked locally because another package had `zod` installed. pnpm's strict mode caught this immediately — npm workspaces would not have.

**Problem 2: Build order.** Running `pnpm -r build` without project references built packages in alphabetical order. The web app tried to build before `shared` was compiled. Adding `references` to each `tsconfig.json` and using `tsc --build` fixed the ordering.

**Problem 3: Type resolution during development.** Before building, TypeScript could not resolve types from sibling packages because the `dist/` directories did not exist yet. The fix was adding `declarationMap: true` to the base config and ensuring the `references` array was correct. With project references, `tsc` resolves types from source during development.

**Problem 4: IDE performance.** VS Code's TypeScript server struggled with three projects. The solution was adding a root `tsconfig.json` with only `references` (no `include`), which tells the language server about the project structure:

```json
{
  "references": [
    { "path": "packages/engine" },
    { "path": "packages/shared" },
    { "path": "apps/web" }
  ],
  "files": []
}
```

## Was It Worth It

Yes. Dependency boundaries are enforced by tooling instead of convention. Each package has its own test suite, lint config, and build step. The engine can be published to npm independently. CI runs are faster because only changed packages are tested.

The migration took about a day. Most of that time was moving files and fixing import paths. The configuration itself — once you know what each field does — is maybe 30 minutes of work.

If your project has two or more distinct concerns sharing code, a pnpm monorepo is worth the setup cost. Start with the structure above and adjust as your project grows.
