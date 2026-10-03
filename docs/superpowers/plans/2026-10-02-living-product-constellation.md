# Living Product Constellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current one-file portfolio with a fast, accessible static site whose primary experience is an interactive constellation of Pavel's AI, security, and Web3 products.

**Architecture:** Vite renders semantic HTML from one typed content registry and progressively enhances it with focused TypeScript modules. CSS and native HTML provide the complete Tier C experience; lightweight DOM/Canvas behavior provides Tier B; a dynamically imported Three.js renderer provides Tier A without becoming a dependency of navigation or content.

**Tech Stack:** Vite, TypeScript, Vitest with jsdom, Playwright, Three.js, CSS custom properties, GitHub Pages, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-02-living-product-constellation-design.md`

## Global Constraints

- Preserve all current public URLs under `/blog/`, `/cv/`, `/posts/`, product assets, icons, and social images.
- Preserve the user's existing uncommitted changes; do not overwrite `publish-next.sh`, Spanish CV files, `posts/bifrost-5-ai-gateways.md`, or `posts/week7-8/` unless a later user-approved requirement makes a targeted edit necessary.
- Primary content and navigation must be present in generated HTML before client-side JavaScript runs.
- React or another client component runtime is out of scope.
- Three.js may be loaded only after Tier A capability selection and may not control content or navigation.
- Do not use scroll hijacking, automatic sound, or autoplaying hero video.
- The explicit motion control overrides automatic capability selection except when the requested tier is unsupported.
- Own compressed JavaScript must remain below 250 KB, excluding the conditionally loaded Three.js chunk.
- Target Lighthouse scores: Performance 90+, Accessibility 95+, Best Practices 95+, SEO 95+.
- No unsupported product claims, fabricated metrics, private API keys, tokens, local paths, or unpublished repository details may enter source data or build output.
- Do not store or use the AIDesigner credential supplied during design discussion.

## Review Focus

- JavaScript or a dynamic import fails: semantic navigation, product content, evidence, CV, and contact links remain usable; covered by Tasks 2, 6, and 8.
- WebGL is unavailable or initialization throws: capability selection falls to Tier B once without hiding products; covered by Tasks 4 and 8.
- Reduced motion is requested or explicitly enabled: continuous motion, parallax, particles, and cursor gravity stay disabled across reloads; covered by Task 4.
- Content contains a missing optional field or unsafe external URL: the optional block disappears and unsafe protocols fail validation; covered by Task 2.
- A legacy URL or publication workflow is exercised after the build migration: the route exists in `dist` and link verification reads the generated page; covered by Tasks 1 and 9.

---

## File Structure

```text
index.html                         Vite HTML entry and server-rendered content marker
vite.config.ts                     semantic HTML transform, chunking, and static-copy hook
src/content/portfolio.ts           single typed source for site, project, proof, and capability data
src/content/writing.ts             curated writing metadata and stable URLs
src/content/link-verification.json last successful external-link verification date
src/content/schema.ts              content types and runtime validation
src/templates/page.ts              complete semantic home-page renderer
src/templates/product.ts           product chapter and proof renderer
src/styles/tokens.css              palette, type, spacing, elevation, and product signatures
src/styles/base.css                reset, typography, focus, and semantic defaults
src/styles/layout.css              page, section, constellation, and responsive layout
src/styles/components.css          navigation, controls, product, proof, writing, and contact UI
src/styles/motion.css              progressive transitions and reduced-motion overrides
src/styles/accessibility.css       skip link, visually-hidden, forced-colors, and motion controls
src/scripts/bootstrap.ts           enhancement entry point and module lifecycle
src/scripts/capability-profile.ts  tier selection and fallback decisions
src/scripts/motion-controller.ts   preference persistence, pause/resume, and effect ownership
src/scripts/navigation.ts          active sections, fragments, focus restoration, and mobile nav
src/scripts/command-palette.ts     accessible keyboard destination search
src/scripts/evidence-mode.ts       Story/Evidence projection control
src/scripts/product-worlds.ts      product chapter entry/exit coordination
src/scripts/constellation-lite.ts  Tier B DOM/Canvas interaction
src/scripts/constellation-webgl.ts dynamically imported Tier A Three.js renderer
src/scripts/contact.ts             clipboard enhancement and mail fallback status
scripts/copy-static.mjs            copies legacy static routes into `dist`
scripts/verify-build.mjs           route, credential, and bundle-budget checks
tests/unit/                        Vitest unit and rendering tests
tests/e2e/                         Playwright accessibility and interaction journeys
.github/workflows/pages.yml        verified static build and GitHub Pages deployment
```

## Task 1: Establish the Static Build Contract

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `vite.config.ts`
- Create: `scripts/copy-static.mjs`
- Create: `scripts/verify-build.mjs`
- Create: `tests/unit/static-build.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `pnpm build` generating `dist/index.html` plus preserved routes; `pnpm verify:build` validating the artifact; `copyStaticRoutes(rootDir: string, outputDir: string): Promise<void>`.
- Consumes: Existing root `blog/`, `cv/`, `posts/`, `assets/`, icon files, `.nojekyll`, and social images without editing their source content.

- [ ] **Step 1: Add a failing static-build contract test**

Create tests named `copies_legacy_public_routes`, `rejects_sensitive_tokens_in_output`, and `reports_missing_required_route`. Assert that a temporary output receives `blog/index.html`, `cv/cv.html`, `.nojekyll`, and a representative asset; that secret patterns including `gp_` and common token labels fail verification; and that a missing `/cv/cv.html` produces a non-zero result.

- [ ] **Step 2: Run the test and verify the build helpers are missing**

Run: `pnpm vitest run tests/unit/static-build.test.ts`

Expected: FAIL because `scripts/copy-static.mjs` and `scripts/verify-build.mjs` do not exist.

- [ ] **Step 3: Add the Vite, Vitest, jsdom, and Three.js dependencies and scripts**

Install `three` as a runtime dependency and `vite`, `vitest`, `jsdom`, and `@types/three` as development dependencies. Set scripts to `"dev": "vite"`, `"build": "vite build && node scripts/verify-build.mjs dist"`, `"preview": "vite preview"`, `"test": "pnpm test:unit"`, `"test:unit": "vitest run"`, `"test:e2e": "playwright test"`, and `"verify:build": "node scripts/verify-build.mjs dist"`. The Vite close-build hook performs the legacy route copy before verification begins. Add `dist/`, `playwright-report/`, `test-results/`, and `coverage/` to `.gitignore`.

- [ ] **Step 4: Implement static copying and artifact verification**

Export `copyStaticRoutes(rootDir, outputDir)` from `scripts/copy-static.mjs`. Export `verifyBuild(outputDir): Promise<{ errors: string[]; compressedOwnJsBytes: number }>` from `scripts/verify-build.mjs`. Required route checks must include `/`, `/blog/`, `/cv/cv.html`, `/cv/cv.pdf`, icons, and existing product images. Scan text output for sensitive-token patterns without printing matched secret values.

- [ ] **Step 5: Configure Vite for a static Pages artifact**

Use `base: '/'`, `publicDir: false`, deterministic manual chunks, and a post-build hook that invokes `copyStaticRoutes`. Do not add semantic page generation until Task 2.

- [ ] **Step 6: Run the contract and a production build**

Run: `pnpm test:unit -- tests/unit/static-build.test.ts && pnpm build`

Expected: all tests PASS; `dist` contains the required legacy routes; verification reports no sensitive data and own JS below 250 KB.

- [ ] **Step 7: Commit the build contract**

```bash
git add package.json pnpm-lock.yaml vite.config.ts scripts/copy-static.mjs scripts/verify-build.mjs tests/unit/static-build.test.ts .gitignore
git commit -m "build: add verified static site pipeline"
```

## Task 2: Create the Content Registry and Semantic Tier C Page

**Files:**
- Modify: `index.html`
- Create: `src/content/schema.ts`
- Create: `src/content/portfolio.ts`
- Create: `src/content/writing.ts`
- Create: `src/content/link-verification.json`
- Create: `src/templates/page.ts`
- Create: `src/templates/product.ts`
- Create: `tests/unit/content.test.ts`
- Create: `tests/unit/render-page.test.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Produces: `validateSiteContent(content: SiteContent): ValidationResult`; `renderHomePage(content: SiteContent): string`; stable product IDs `spectr-ai`, `argus`, `argus-lens`, `scry`, and `folio`.
- Consumes: Verified claims, links, and images already present in `index.html`; route-copy behavior from Task 1.

- [ ] **Step 1: Write failing content validation tests**

Test `accepts_complete_verified_content`, `rejects_duplicate_product_ids`, `rejects_non_http_external_urls`, `omits_missing_optional_evidence`, and `requires_capability_product_relationships`. Assert that `javascript:` and protocol-relative URLs are rejected and that every capability references a real product or writing ID.

- [ ] **Step 2: Write failing semantic rendering tests**

Assert that rendered HTML contains one `main`, ordered section headings, the exact positioning “Pavel builds extraordinary products at the intersection of AI, security, and Web3.”, all six navigation labels, all five product IDs, Story/Evidence controls, skip link, CV links, email fallback, and no empty evidence container for absent evidence.

- [ ] **Step 3: Run the tests and verify they fail**

Run: `pnpm test:unit -- tests/unit/content.test.ts tests/unit/render-page.test.ts`

Expected: FAIL because the schema, content, and renderers do not exist.

- [ ] **Step 4: Define the content interfaces and validator**

Define `SiteContent`, `Product`, `EvidenceItem`, `Capability`, `WritingEntry`, `ExternalLink`, and `VisualSignature` in `src/content/schema.ts`. Keep evidence source URL and optional verification date explicit. Validate data before rendering and return errors without echoing full sensitive values.

- [ ] **Step 5: Populate the single content source from existing verified material**

Move existing project descriptions, links, images, audit links, experience, CV routes, writing links, and contact data into the registry. Import the initial verified-links date from `src/content/link-verification.json` so the scheduled verifier can update data without rewriting a generated page. Add Folio only with claims and links that exist in the repository or can be independently verified; otherwise label it accurately or omit unsupported evidence.

- [ ] **Step 6: Implement semantic product and page renderers**

Render complete Product Worlds, Proof Layer, Capability Matrix, writing stream, About, and contact content. Use escaped text, native anchors, buttons for stateful controls, and meaningful image alternatives. The initial HTML must expose all product chapters even if later CSS presents them progressively.

- [ ] **Step 7: Inject rendered content during Vite HTML transformation**

Make `index.html` a minimal metadata-and-entry shell with a unique `<!-- portfolio-content -->` marker. In `vite.config.ts`, validate the registry and replace the marker using `renderHomePage`; abort builds on validation errors.

- [ ] **Step 8: Run rendering tests and inspect the no-script build**

Run: `pnpm test:unit -- tests/unit/content.test.ts tests/unit/render-page.test.ts && pnpm build`

Expected: PASS; `dist/index.html` contains all primary copy, destinations, and product evidence without executing JavaScript.

- [ ] **Step 9: Commit the semantic experience**

```bash
git add index.html vite.config.ts src/content src/templates tests/unit/content.test.ts tests/unit/render-page.test.ts
git commit -m "feat: render semantic portfolio from typed content"
```

## Task 3: Build the Obsidian Aurora Design System

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Create: `src/styles/layout.css`
- Create: `src/styles/components.css`
- Create: `src/styles/motion.css`
- Create: `src/styles/accessibility.css`
- Create: `tests/e2e/static-layout.spec.ts`
- Modify: `index.html`

**Interfaces:**
- Produces: CSS tokens named `--color-void`, `--color-deep-space`, `--color-soft-white`, `--color-signal-cyan`, `--color-neural-violet`, `--color-security-amber`, `--color-verification-green`, and `--color-critical-coral`; responsive static layout used by all later tasks.
- Consumes: semantic class names and `data-product` attributes rendered by Task 2.

- [ ] **Step 1: Write failing visual-structure browser tests**

At desktop, tablet, and mobile widths, assert that the skip link can become visible, primary nav and CTA are reachable, every product chapter has a non-zero box, no horizontal overflow exists, and the contact actions remain visible at 200% zoom-equivalent viewport sizing.

- [ ] **Step 2: Run the layout test against the unstyled page**

Run: `pnpm test:e2e -- tests/e2e/static-layout.spec.ts`

Expected: FAIL on layout and visibility assertions.

- [ ] **Step 3: Implement tokens, typography, base states, and responsive layout**

Use the exact palette from the spec and product signature variables. Provide resilient local/system fallbacks for display, sans, and mono roles. Build mobile-first layouts with container queries or media queries where they reduce component coupling.

- [ ] **Step 4: Style the complete Tier C experience**

Style navigation, arrival, static constellation/list, Product Worlds, mode controls, proof entries, capability relationships, writing stream, About, and contact. Ensure essential copy sits above atmosphere layers and decorative layers use `pointer-events: none`.

- [ ] **Step 5: Add accessibility and reduced-motion CSS**

Include visible focus, skip link, `:focus-visible`, forced-colors treatment, visually-hidden utility, minimum practical 44px targets, and a global `prefers-reduced-motion` override that disables continuous and spatial animation.

- [ ] **Step 6: Run layout tests and manually inspect three breakpoints**

Run: `pnpm test:e2e -- tests/e2e/static-layout.spec.ts`

Expected: PASS at configured desktop, tablet, and mobile projects with no horizontal overflow.

- [ ] **Step 7: Commit the Tier C visual system**

```bash
git add index.html src/styles tests/e2e/static-layout.spec.ts
git commit -m "feat: add obsidian aurora responsive design system"
```

## Task 4: Add Capability Profiling and Motion Governance

**Files:**
- Create: `src/scripts/capability-profile.ts`
- Create: `src/scripts/motion-controller.ts`
- Create: `tests/unit/capability-profile.test.ts`
- Create: `tests/unit/motion-controller.test.ts`

**Interfaces:**
- Produces: `selectCapabilityProfile(input: CapabilityInput): 'tier-a' | 'tier-b' | 'tier-c'`, where `CapabilityInput` contains `reducedMotion`, `webgl`, `precisePointer`, `viewportWidth`, optional `deviceMemoryGB`, and optional `webglFailed`; `createMotionController(storage: StorageLike, media: MotionMedia): MotionController`; controller methods `getPreference()`, `setPreference(value)`, `register(effect)`, `pauseAll()`, and `resumeEligible()`.
- Consumes: Browser capability facts supplied by `bootstrap.ts` in Task 5; no direct ownership of page content.

- [ ] **Step 1: Write failing tier-selection tests**

Cover reduced motion, missing WebGL, coarse pointer, narrow viewport, low memory when available, WebGL initialization failure, and a full-capability desktop. Assert reduced motion always yields Tier C, unsupported WebGL never yields Tier A, and failure downgrades only once.

- [ ] **Step 2: Write failing motion-controller tests**

Assert default preference follows the media query, explicit `full` or `reduced` persists under `portfolio:motion`, explicit reduced survives reload, hidden-document pause stops registered effects, and only eligible effects resume.

- [ ] **Step 3: Run the tests and verify missing-module failures**

Run: `pnpm test:unit -- tests/unit/capability-profile.test.ts tests/unit/motion-controller.test.ts`

Expected: FAIL because both modules are absent.

- [ ] **Step 4: Implement pure capability selection**

Keep detection inputs separate from decision logic. Do not use user-agent sniffing. Return Tier C for reduced motion, Tier B for usable non-WebGL environments, and Tier A only when all required capabilities are present.

- [ ] **Step 5: Implement centralized motion ownership**

Persist only the user's motion preference. Effects implement `start(): void`, `pause(): void`, and `destroy(): void`; the controller handles document visibility and preference changes without recreating unrelated UI.

- [ ] **Step 6: Run unit tests**

Run: `pnpm test:unit -- tests/unit/capability-profile.test.ts tests/unit/motion-controller.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit capability and motion foundations**

```bash
git add src/scripts/capability-profile.ts src/scripts/motion-controller.ts tests/unit/capability-profile.test.ts tests/unit/motion-controller.test.ts
git commit -m "feat: govern progressive motion capabilities"
```

## Task 5: Enhance Navigation, Motion Controls, and Command Palette

**Files:**
- Create: `src/scripts/bootstrap.ts`
- Create: `src/scripts/navigation.ts`
- Create: `src/scripts/command-palette.ts`
- Create: `src/scripts/contact.ts`
- Create: `tests/unit/command-palette.test.ts`
- Create: `tests/e2e/navigation.spec.ts`
- Modify: `src/templates/page.ts`

**Interfaces:**
- Produces: `bootstrapPortfolio(document, window): Cleanup`; `createNavigationController(options): NavigationController`; `createCommandPalette(destinations): CommandPalette`; clipboard enhancement with mail-link fallback.
- Consumes: `selectCapabilityProfile` and `createMotionController` from Task 4; destination IDs and labels from the Task 2 content registry.

- [ ] **Step 1: Write failing command search tests**

Assert case-insensitive ranking for section and product names, exact product matches before partial writing matches, and an empty query returning the curated destination order.

- [ ] **Step 2: Write failing browser journeys**

Assert skip-link behavior, fragment navigation, active-section state, mobile menu keyboard operation, `Ctrl/Cmd+K` command palette opening, dialog focus containment, Escape close with focus restoration, motion-control persistence, clipboard success announcement, and working `mailto:` fallback when clipboard rejection is simulated.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm test:unit -- tests/unit/command-palette.test.ts && pnpm test:e2e -- tests/e2e/navigation.spec.ts`

Expected: FAIL because enhancement modules are missing.

- [ ] **Step 4: Render palette and control semantics**

Add the motion toggle, command dialog, live status region, and mobile navigation button to the semantic template. Keep normal anchors in the page so navigation works before bootstrap.

- [ ] **Step 5: Implement bootstrap and navigation lifecycle**

Initialize each enhancement independently in guarded blocks. Set `data-capability-tier` on the root, manage fragments and focus without suppressing native behavior, and return one cleanup function for tests and hot reload.

- [ ] **Step 6: Implement the accessible command palette and contact enhancement**

Use the rendered dialog pattern, roving selection, focus restoration, and text matching proven by unit tests. On clipboard failure, preserve selection and expose the existing mail action rather than treating copy as the only path.

- [ ] **Step 7: Run navigation tests**

Run: `pnpm test:unit -- tests/unit/command-palette.test.ts && pnpm test:e2e -- tests/e2e/navigation.spec.ts`

Expected: PASS for desktop and mobile keyboard journeys.

- [ ] **Step 8: Commit interface enhancements**

```bash
git add src/templates/page.ts src/scripts/bootstrap.ts src/scripts/navigation.ts src/scripts/command-palette.ts src/scripts/contact.ts tests/unit/command-palette.test.ts tests/e2e/navigation.spec.ts
git commit -m "feat: add accessible portfolio navigation"
```

## Task 6: Implement Product Worlds and Story/Evidence Modes

**Files:**
- Create: `src/scripts/evidence-mode.ts`
- Create: `src/scripts/product-worlds.ts`
- Create: `tests/unit/evidence-mode.test.ts`
- Create: `tests/e2e/product-worlds.spec.ts`
- Modify: `src/templates/product.ts`
- Modify: `src/styles/components.css`
- Modify: `src/styles/motion.css`

**Interfaces:**
- Produces: `createEvidenceMode(root, storage): EvidenceModeController`; `createProductWorlds(root, motion): ProductWorldController`; methods `open(productId)`, `close()`, and `destroy()`.
- Consumes: stable product IDs and shared content from Task 2; motion controller from Task 4; navigation focus contract from Task 5.

- [ ] **Step 1: Write failing evidence-state tests**

Assert default Story mode, Evidence mode selection using `aria-pressed`, one shared product record as the source, local persistence under `portfolio:presentation`, invalid stored values falling back to Story, and unsupported optional evidence rendering no empty region.

- [ ] **Step 2: Write failing Product World browser tests**

Open every product from the static constellation/list by keyboard and pointer. Assert the matching chapter is identified, URL fragment updates, close/back restores focus, Story/Evidence retains reading context, and the experience remains readable with JavaScript disabled.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm test:unit -- tests/unit/evidence-mode.test.ts && pnpm test:e2e -- tests/e2e/product-worlds.spec.ts`

Expected: FAIL because controllers do not exist.

- [ ] **Step 4: Implement state projection without content duplication**

Toggle pre-rendered story and evidence projections derived by `renderProduct` from the same record. Use accessible button state and a polite status announcement; do not inject claims from client-side strings.

- [ ] **Step 5: Implement Product World entry and exit**

Coordinate active product, history fragments, focus, scroll position, and motion-controller effects. Use View Transitions only behind capability detection and retain immediate state changes as the fallback.

- [ ] **Step 6: Style product-specific atmospheres and transitions**

Apply signature variables from Task 3. Product identity may change accent and ambient layers but not control placement, reading order, or interaction semantics.

- [ ] **Step 7: Run unit and browser tests**

Run: `pnpm test:unit -- tests/unit/evidence-mode.test.ts && pnpm test:e2e -- tests/e2e/product-worlds.spec.ts`

Expected: PASS with JavaScript enabled and disabled scenarios.

- [ ] **Step 8: Commit Product Worlds**

```bash
git add src/templates/product.ts src/scripts/evidence-mode.ts src/scripts/product-worlds.ts src/styles/components.css src/styles/motion.css tests/unit/evidence-mode.test.ts tests/e2e/product-worlds.spec.ts
git commit -m "feat: add product worlds and evidence mode"
```

## Task 7: Add the Tier B Living Constellation

**Files:**
- Create: `src/scripts/constellation-lite.ts`
- Create: `tests/unit/constellation-layout.test.ts`
- Create: `tests/e2e/constellation-lite.spec.ts`
- Modify: `src/scripts/bootstrap.ts`
- Modify: `src/styles/layout.css`
- Modify: `src/styles/motion.css`

**Interfaces:**
- Produces: `createLiteConstellation(root, products, motion): ConstellationController`; controller methods `focusProduct(id)`, `resize(bounds)`, `pause()`, and `destroy()`.
- Consumes: stable product order and signatures from Task 2; Tier B decision and motion registration from Task 4; Product World activation from Task 6.

- [ ] **Step 1: Write failing deterministic layout tests**

Assert that five stable product IDs map to bounded non-overlapping anchor regions at representative desktop and mobile sizes, the same input produces the same layout, and missing dimensions return the static arrangement rather than throwing.

- [ ] **Step 2: Write failing Tier B interaction tests**

Force Tier B and assert all product controls remain keyboard reachable, focus and hover expose equivalent preview text, coarse-pointer taps do not require hover, off-screen animation pauses, resize preserves a valid layout, and reduced motion uses the static arrangement.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm test:unit -- tests/unit/constellation-layout.test.ts && pnpm test:e2e -- tests/e2e/constellation-lite.spec.ts`

Expected: FAIL because the Tier B engine is absent.

- [ ] **Step 4: Implement deterministic DOM/Canvas enhancement**

Keep semantic product buttons as the interaction layer. Use Canvas only for decorative paths and atmosphere, never for labels or hit targets. Clamp pointer gravity and disable it for coarse pointers or reduced motion.

- [ ] **Step 5: Integrate Tier B through bootstrap**

Create and register the controller only for Tier B. Catch initialization errors and leave Tier C untouched. Destroy observers, animation frames, and listeners during cleanup.

- [ ] **Step 6: Run Tier B tests**

Run: `pnpm test:unit -- tests/unit/constellation-layout.test.ts && pnpm test:e2e -- tests/e2e/constellation-lite.spec.ts`

Expected: PASS across keyboard, touch-sized, reduced-motion, and resize cases.

- [ ] **Step 7: Commit the lightweight constellation**

```bash
git add src/scripts/constellation-lite.ts src/scripts/bootstrap.ts src/styles/layout.css src/styles/motion.css tests/unit/constellation-layout.test.ts tests/e2e/constellation-lite.spec.ts
git commit -m "feat: add lightweight product constellation"
```

## Task 8: Add the Tier A Three.js Constellation and Recovery

**Files:**
- Create: `src/scripts/constellation-webgl.ts`
- Create: `tests/unit/constellation-webgl.test.ts`
- Create: `tests/e2e/progressive-fallback.spec.ts`
- Modify: `src/scripts/bootstrap.ts`
- Modify: `src/scripts/capability-profile.ts`
- Modify: `src/styles/motion.css`

**Interfaces:**
- Produces: default dynamic factory `createWebGLConstellation(options): Promise<ConstellationController>`; `downgradeCapability(current, reason): 'tier-b' | 'tier-c'`.
- Consumes: the same `ConstellationController` contract as Task 7, semantic product controls, product signatures, Product World events, and centralized motion lifecycle.

- [ ] **Step 1: Write failing renderer lifecycle tests**

Mock Three.js boundaries and assert initialization uses product IDs, selection emits the matching semantic activation, resize updates renderer dimensions, pause stops frames, destroy disposes scenes/materials/listeners, and product copy never originates inside the WebGL module.

- [ ] **Step 2: Write failing progressive-fallback browser tests**

Assert Three.js is not requested for Tier B/C; a rejected dynamic import leaves all content usable and selects Tier B; a thrown WebGL initialization selects Tier B only once; sustained simulated frame instability downgrades once; and a missing decorative image retains product label and activation.

- [ ] **Step 3: Run tests and verify failure**

Run: `pnpm test:unit -- tests/unit/constellation-webgl.test.ts && pnpm test:e2e -- tests/e2e/progressive-fallback.spec.ts`

Expected: FAIL because the Tier A renderer and recovery integration are absent.

- [ ] **Step 4: Implement the isolated Three.js renderer**

Dynamically import Three.js only inside the Tier A bootstrap branch. Render product bodies, restrained connection paths, and atmosphere from product visual tokens. Keep HTML controls aligned as the accessible interaction surface and treat GPU picking as optional enhancement.

- [ ] **Step 5: Implement stability monitoring and one-way downgrade**

After a two-second warm-up, measure consecutive two-second frame windows. If three consecutive windows average below 45 FPS, destroy Tier A and initialize Tier B once. Never upgrade automatically within the same page session and never oscillate.

- [ ] **Step 6: Run lifecycle and failure tests**

Run: `pnpm test:unit -- tests/unit/constellation-webgl.test.ts && pnpm test:e2e -- tests/e2e/progressive-fallback.spec.ts`

Expected: PASS; request traces show no Three.js chunk for Tier B/C.

- [ ] **Step 7: Check production chunking and budget**

Run: `pnpm build && pnpm verify:build`

Expected: Three.js is a separate lazy chunk; own compressed JS remains below 250 KB; no sensitive token patterns appear.

- [ ] **Step 8: Commit the full constellation**

```bash
git add src/scripts/constellation-webgl.ts src/scripts/bootstrap.ts src/scripts/capability-profile.ts src/styles/motion.css tests/unit/constellation-webgl.test.ts tests/e2e/progressive-fallback.spec.ts
git commit -m "feat: add progressive webgl constellation"
```

## Task 9: Update Link Verification and GitHub Pages Deployment

**Files:**
- Modify: `scripts/verify-links.mjs`
- Modify: `.github/workflows/verify-links.yml`
- Create: `.github/workflows/pages.yml`
- Create: `tests/unit/verify-links.test.ts`
- Create: `tests/e2e/routes.spec.ts`

**Interfaces:**
- Produces: link verifier accepting an explicit HTML path and optional JSON stamp target; Pages workflow that deploys only a verified `dist` artifact.
- Consumes: `pnpm build`, `pnpm verify:build`, and preserved routes from Task 1; current scheduled external-link behavior.

- [ ] **Step 1: Write failing link-verifier tests**

Assert generated HTML is scanned, bot-wall statuses remain non-fatal, `404`, `410`, and network errors remain fatal, `--stamp-file src/content/link-verification.json` changes only that JSON date after a successful check, and check-only mode does not modify source files.

- [ ] **Step 2: Write failing route tests against the production preview**

Assert `/`, `/blog/`, each currently linked blog article, `/cv/cv.html`, `/cv/cv.pdf`, Spanish CV routes when present, product images, favicons, and representative posts return successful responses without client-side redirects.

- [ ] **Step 3: Run tests and verify current workflow assumptions fail**

Run: `pnpm test:unit -- tests/unit/verify-links.test.ts && pnpm test:e2e -- tests/e2e/routes.spec.ts`

Expected: FAIL because verification still assumes source `index.html` and no Pages artifact workflow exists.

- [ ] **Step 4: Refactor link verification without changing failure semantics**

Accept `--input <path>` and optional `--stamp-file <path>` arguments. Use `dist/index.html` for checks. The scheduled workflow updates `src/content/link-verification.json` only after every external link passes, commits that single file when its date changed, and never rewrites generated HTML.

- [ ] **Step 5: Add the Pages build-and-deploy workflow**

Pin actions, use Node 22 and the locked pnpm version, run unit tests, build, artifact verification, browser smoke tests, then deploy `dist`. Grant only Pages and OIDC permissions required by the deploy job.

- [ ] **Step 6: Run route and link tests against a production preview**

Run: `pnpm build && pnpm preview --host 127.0.0.1` in the test web-server configuration, then `pnpm test:e2e -- tests/e2e/routes.spec.ts` and `node scripts/verify-links.mjs --input dist/index.html`.

Expected: PASS with every inventoried legacy route available.

- [ ] **Step 7: Commit deployment and route preservation**

```bash
git add scripts/verify-links.mjs .github/workflows/verify-links.yml .github/workflows/pages.yml tests/unit/verify-links.test.ts tests/e2e/routes.spec.ts
git commit -m "ci: deploy verified portfolio build"
```

## Task 10: Complete Accessibility, Visual, and Release Verification

**Files:**
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/reduced-motion.spec.ts`
- Create: `tests/e2e/visual.spec.ts`
- Create: `tests/e2e/fixtures/capabilities.ts`
- Create: `playwright.config.ts`
- Create: `lighthouserc.json`
- Modify: `package.json`
- Modify: `.github/workflows/pages.yml`
- Create: `docs/development.md`

**Interfaces:**
- Produces: repeatable release command `pnpm verify`; documented local preview and rollback procedure.
- Consumes: completed static build and all three capability tiers.

- [ ] **Step 1: Add failing release journeys**

Test heading/landmark structure, accessible names, keyboard-only arrival-to-contact journey, dialog behavior, live announcements, 200% reflow, forced-colors essential controls, Tier C under reduced motion, no continuous animation in Tier C, and screenshots for desktop/mobile Story and Evidence states.

- [ ] **Step 2: Configure the browser matrix and capability fixtures**

Define Chromium desktop, Chromium mobile/touch, Firefox desktop, and WebKit desktop projects. Provide deterministic Tier A/B/C overrides used only by tests. Configure the Vite production preview as Playwright's web server.

- [ ] **Step 3: Run the release suite and capture failures**

Run: `pnpm test:unit && pnpm build && pnpm test:e2e`

Expected: Any remaining accessibility, responsive, recovery, or browser-specific issue is exposed before release.

- [ ] **Step 4: Fix only failures attributable to the redesign**

Update the owning module or stylesheet for each failing assertion. Do not weaken tests, remove content, or modify unrelated publishing files to obtain a pass.

- [ ] **Step 5: Add Lighthouse budgets and the unified verifier**

Configure the four score thresholds from Global Constraints against the production preview. Set `pnpm verify` to run unit tests, production build, artifact verification, browser tests, and Lighthouse CI in that order.

- [ ] **Step 6: Document local development, content editing, tiers, and rollback**

Document installation, `pnpm dev`, content registry editing, `pnpm verify`, preview, static-route rules, how motion tiers work, and rollback by redeploying the preceding known-good commit.

- [ ] **Step 7: Run the complete release gate**

Run: `pnpm verify`

Expected: all unit and browser tests PASS; build verification reports required routes, no sensitive patterns, and JS budget compliance; Lighthouse meets all four thresholds.

- [ ] **Step 8: Inspect the final diff and user-owned files**

Run: `git status --short && git diff --check && git diff --stat b69ad04..HEAD`

Expected: no whitespace errors; the pre-existing user-owned modifications remain present and are not included in redesign commits unless explicitly required and reviewed.

- [ ] **Step 9: Commit release verification**

```bash
git add tests/e2e playwright.config.ts lighthouserc.json package.json pnpm-lock.yaml .github/workflows/pages.yml docs/development.md
git commit -m "test: add portfolio release verification"
```

- [ ] **Step 10: Stop for final review before production deployment**

Present the local production preview, test results, Lighthouse results, route inventory, and final diff. Do not publish or change GitHub Pages settings until the user explicitly approves the release artifact.
