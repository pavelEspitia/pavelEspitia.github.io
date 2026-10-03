# Portfolio development

## Local setup

Install Node.js 22 or newer and pnpm 10.19.0, then run `pnpm install --frozen-lockfile`. Use `pnpm dev` for live development and `pnpm build && pnpm preview` to inspect the production artifact.

## Editing content

Portfolio claims, product links, proof, writing, biography, and contact details live in `src/content/portfolio.ts` and `src/content/writing.ts`. Keep one source record per product; the Story and Evidence views are projections of those records. Run `pnpm test` after editing content.

## Capability tiers and motion

- Tier A adds the lazy Three.js constellation on capable desktop browsers.
- Tier B adds a lightweight decorative canvas while retaining semantic HTML controls.
- Tier C is the static, accessible experience used for reduced motion and constrained environments.

The visitor's explicit motion preference is stored under `portfolio:motion`. Renderer failures degrade once to a safer tier and never oscillate during a page session.

## Static routes

`scripts/copy-static.mjs` copies the existing blog, CV, post, cover, image, favicon, and metadata routes into `dist`. Add new publishable extensions to its allowlist deliberately. Run `pnpm verify:build` to confirm preserved routes and scan the artifact for sensitive values.

## Release verification

Run `pnpm verify`. It executes unit tests, produces and verifies the build, runs the browser matrix, and checks Lighthouse thresholds. The GitHub Pages workflow publishes only the verified `dist` artifact.

## Rollback

Find the preceding known-good commit, create a revert commit for the release change, run `pnpm verify`, and redeploy that verified commit through the Pages workflow. Do not edit the generated Pages artifact directly.
