# Living Product Constellation — Portfolio Redesign Specification

## 1. Purpose

Redesign `pavelEspitia.github.io` as an immersive portfolio that positions Pavel Espitia as a product builder working across AI, security, and Web3.

The experience must create an immediate sense of technical ambition without becoming a visual demo that obscures the work. It should make the products memorable, make evidence easy to inspect, and give potential collaborators a clear path to contact Pavel.

Primary positioning:

> Pavel builds extraordinary products at the intersection of AI, security, and Web3.

The redesign targets technical founders, engineering leaders, security teams, potential collaborators, and technically curious readers.

## 2. Success Criteria

The redesign succeeds when:

- A first-time visitor understands Pavel's positioning within ten seconds.
- The product portfolio is the dominant visual and narrative element.
- Every featured project connects a compelling story to concrete technical evidence.
- The site feels unusually interactive while remaining fast, readable, and navigable.
- Keyboard, touch, reduced-motion, and non-WebGL experiences retain all essential content and actions.
- Existing public URLs for the CV, blog, posts, and assets remain functional.
- The production site is not replaced until automated and manual validation pass.

## 3. Design Direction

### 3.1 Concept

The selected direction is **Living Product Constellation**: Pavel's products form a navigable universe rather than a conventional card grid. Each product is represented as a distinct celestial object with its own motion, color signature, visual atmosphere, and evidence trail.

The constellation is not a decorative menu. It is the primary portfolio index and a spatial representation of the relationship between Pavel's work in AI, security, verification, and Web3.

### 3.2 Visual Identity: Obsidian Aurora

The site uses a near-black environment with restrained luminous accents. Large quiet areas, editorial typography, and controlled gradients keep the design sophisticated rather than game-like.

Core palette:

| Token | Value | Use |
| --- | --- | --- |
| Void | `#05070D` | Primary background |
| Deep Space | `#090D18` | Elevated surfaces and transitions |
| Soft White | `#F4F7F5` | Primary text |
| Signal Cyan | `#57E6FF` | AI, interaction, focus |
| Neural Violet | `#9173FF` | Intelligence and generative systems |
| Security Amber | `#FFBE55` | Security and warnings |
| Verification Green | `#5BF0A5` | Proof and verified states |
| Critical Coral | `#FF6577` | Risk, critical findings, emphasis |

Product signatures:

- **spectr-ai:** gold and neural violet.
- **Argus:** critical coral and security amber.
- **Argus Lens:** ultraviolet and cool white.
- **Scry:** signal cyan and deep blue.
- **Folio:** mineral green and warm cream.

Typography combines:

- A variable display serif for major statements and editorial tension.
- A geometric grotesk for navigation and body copy.
- A monospaced face for evidence, metrics, commands, and technical metadata.

Fonts must be self-hosted or loaded with a resilient system-font fallback. Text rendering must never wait for decorative typography.

### 3.3 Depth System

The visual environment has four layers:

1. **Atmosphere:** subtle grain, aurora gradients, and low-frequency light.
2. **Constellation:** product bodies, connecting paths, and spatial labels.
3. **Interface:** navigation, controls, content surfaces, and focus states.
4. **Evidence:** metrics, implementation details, links, and verification states.

Content remains visually above ambient effects. The atmosphere may enrich a section but may not reduce text contrast or intercept pointer input.

## 4. Information Architecture

Primary navigation:

1. Universe
2. Products
3. Proof
4. Writing
5. About
6. Contact

The page follows this narrative sequence.

### 4.1 Arrival — “The Signal”

The opening view introduces Pavel's name and positioning with a short generative signal that resolves into the product constellation.

Required content:

- Pavel Espitia.
- The approved positioning statement.
- A concise supporting statement grounded in product building.
- Primary action: explore products.
- Secondary action: contact Pavel.
- Immediate access to navigation and reduced-motion controls.

The opening animation must not block interaction, delay content, or replay on every navigation action.

### 4.2 Product Constellation

The constellation presents the featured products as distinct interactive bodies. Proximity, connecting paths, and restrained orbital motion imply relationships between products without requiring the visitor to understand a literal diagram.

Each product object provides:

- Product name.
- One-line purpose.
- Domain signal such as AI, security, or Web3.
- Status or proof cue.
- Keyboard-focusable activation target.

Hover, focus, or touch reveals a preview. Activation moves into the corresponding Product World through a native-feeling transition. A conventional product list remains present in the document and becomes the primary interface when motion or graphics are unavailable.

### 4.3 Product Worlds

Each featured product receives a dedicated visual chapter with a shared structure and an individual atmosphere.

Required sequence:

1. The problem.
2. The product response.
3. A representative visual or interaction.
4. Technical architecture or differentiator.
5. Evidence and current status.
6. Relevant external links.

The product world may change accent colors and local motion language, but navigation, content hierarchy, interaction semantics, and accessibility behavior remain consistent.

### 4.4 Proof Layer

Visitors can switch between two presentation modes:

- **Story:** concise narrative and product impact.
- **Evidence:** architecture, implementation facts, metrics, repositories, demos, technical constraints, and verification artifacts.

This is a presentation change, not two different sources of truth. Both modes are generated from the same product data and preserve the current reading position where practical.

If evidence is unavailable for a claim, the interface omits the unsupported claim rather than displaying invented metrics or placeholder values.

### 4.5 Capability Matrix

The capability section connects Pavel's skills to delivered systems instead of presenting a detached technology inventory.

Capabilities are grouped around outcomes such as:

- AI systems and agentic products.
- Security engineering and verification.
- Web3 infrastructure and smart-contract tooling.
- Product architecture and developer experience.

Each capability links back to at least one real product, article, or artifact.

### 4.6 Writing as Signal

Writing appears as an evolving signal stream rather than a generic blog grid. Entries expose title, topic, publication date, and a short relevance statement. Existing blog and post URLs remain stable.

The interface should favor recent and representative work while offering a direct path to the complete archive.

### 4.7 About and Final Contact

The closing section provides a concise biography, selected experience, CV links, and the final statement:

> Building something difficult? Good.

Contact actions must work without custom pointer behavior and must include explicit labels. Copy-to-clipboard behavior needs a visible success message and a normal mail link as fallback.

## 5. Interaction and Motion

### 5.1 Signature Interactions

- **Cursor lens:** reveals local metadata and subtle depth on precise-pointer devices only.
- **Product gravity:** nearby constellation objects respond gently to pointer or focus proximity.
- **Evidence mode:** transitions between narrative and technical content without a page reload.
- **Command palette:** provides keyboard navigation to sections, products, writing, CV, and contact.
- **Generative signature:** a deterministic visual motif derived from Pavel's product universe.

These interactions are progressive enhancements. None may be required to discover content or complete navigation.

### 5.2 Motion Principles

- Motion communicates hierarchy, relationship, entry, exit, or state change.
- No scroll hijacking, forced scroll duration, or hidden native scrollbar.
- Scroll-driven CSS animation is preferred when supported.
- JavaScript updates use `requestAnimationFrame` and avoid layout thrashing.
- Off-screen ambient effects pause.
- Product transitions preserve orientation and provide an obvious return path.
- Decorative motion stops when the document is hidden.
- No automatic sound.

### 5.3 Reduced Motion

When `prefers-reduced-motion: reduce` is active:

- The arrival resolves immediately.
- Constellation bodies remain stationary.
- Parallax, inertia, particles, and cursor gravity are disabled.
- View transitions become short opacity changes or immediate state changes.
- All information and actions remain available.

The site also offers an explicit motion toggle whose setting is retained locally. The explicit user choice overrides automatic capability selection except where the browser or device cannot support the requested level.

## 6. Technical Architecture

### 6.1 Platform

Use a small Vite and TypeScript build that outputs a static GitHub Pages site. Do not introduce React or another component runtime unless implementation reveals a requirement that cannot be satisfied cleanly with native modules.

The generated site must contain semantic HTML for primary content before client-side enhancement. JavaScript adds spatial rendering, transitions, filters, and convenience behaviors; it does not supply the only copy of portfolio content.

Three.js is permitted only for the main constellation and related product-world atmosphere. It must be dynamically imported after capability detection and may not become a dependency of navigation, text rendering, or evidence access.

### 6.2 Proposed Source Structure

```text
src/
  content/
    portfolio.ts
    writing.ts
  styles/
    tokens.css
    base.css
    layout.css
    components.css
    motion.css
    accessibility.css
  scripts/
    bootstrap.ts
    capability-profile.ts
    constellation-engine.ts
    motion-controller.ts
    navigation-controller.ts
    product-worlds.ts
    evidence-mode.ts
    command-palette.ts
  templates/
    page.ts
    product.ts
public/
  assets/
  blog/
  cv/
  posts/
```

The exact filenames may change during planning, but the boundaries must remain: content, rendering, motion, navigation, and capability detection stay independently understandable and testable.

### 6.3 Component Responsibilities

#### Capability Profile

Determines the supported presentation tier from reduced-motion preference, pointer precision, viewport, WebGL support, memory hints when available, and observed frame stability. It exposes a stable profile to other modules and never hides content.

#### Constellation Engine

Renders spatial product objects and decorative relationships. It consumes product identifiers and visual tokens, emits semantic selection events, and has no ownership of routing or product copy.

#### Motion Controller

Centralizes motion preference, lifecycle pausing, visibility handling, and cleanup. Components request named effects instead of independently creating unrestricted animation loops.

#### Navigation Controller

Maintains active-section state, focus movement, URL fragments, and safe restoration after transitions. Native anchors remain the fallback.

#### Product Worlds

Coordinates entry to and exit from product chapters. It does not duplicate product content or invent navigation semantics.

#### Evidence Mode

Switches a product view between story and evidence projections from the same structured data. The selected mode is reflected with accessible controls and may be retained locally.

#### Command Palette

Provides searchable access to existing destinations. It uses a dialog pattern, supports full keyboard operation, traps focus only while open, and restores focus when closed.

### 6.4 Content Model

Each featured product has one structured record containing:

- Stable identifier and display name.
- Short and extended descriptions.
- Problem, response, and differentiator.
- Domain tags.
- Product-specific visual tokens.
- Media references and meaningful alternative text.
- Evidence entries with type, label, value, source URL, and optional verification date.
- Repository, live product, and article links where available.
- Capability relationships.

Content entered in this registry is escaped when rendered. External links use explicit protocols and appropriate `rel` attributes. Missing optional fields remove their corresponding UI blocks cleanly.

### 6.5 Static Assets and Existing Routes

The build preserves or intentionally maps all current public paths, including:

- `/blog/` and individual blog pages.
- `/cv/cv.html` and the existing PDF CV.
- Spanish CV files already present in the working tree.
- `/posts/` source artifacts where currently published or referenced.
- Favicons, social images, and product assets.

The existing content publication scripts and scheduled workflows remain outside the redesign unless a path adjustment is required for the static output. Any such adjustment must preserve their current behavior and the user's uncommitted edits.

### 6.6 Build and Deployment

The default branch remains the source of truth. GitHub Actions will:

1. Install locked dependencies.
2. Run type and content validation.
3. Build the static output.
4. Run link and automated browser checks against the output.
5. Upload the verified artifact to GitHub Pages.

The existing production site stays available until the build pipeline and redesigned output are validated. Deployment configuration must support a documented local preview that matches the Pages base path.

## 7. Capability Tiers and Failure Handling

### Tier A — Full Spatial Experience

For capable desktop and mobile devices with WebGL and normal motion preferences:

- Three-dimensional constellation.
- Controlled particle atmosphere.
- Product gravity and depth transitions.
- Full product-world motion.

### Tier B — Lightweight Interactive Experience

For devices with limited graphics capacity or where stable rendering cannot be maintained:

- Canvas or CSS-based constellation.
- Simplified transforms and transitions.
- No continuous particle field.
- All previews and product chapters remain interactive.

### Tier C — Static and Reduced Experience

For reduced-motion users, unsupported browsers, script failure, or severe capability limits:

- Static product map or product list.
- Immediate section changes.
- Native anchors and disclosure controls.
- Complete content and evidence.

### Runtime Recovery

- WebGL initialization failure immediately selects Tier B without an error modal.
- Repeated frame instability selects a lower tier once and does not oscillate between tiers.
- Missing decorative media uses a product-color placeholder while preserving its caption and alternative text.
- A failed dynamic import leaves the semantic interface functional and records a non-sensitive diagnostic in development only.
- Clipboard failure leaves the address selectable and instructs the visitor to copy it manually.
- External links are never disabled solely because a preview or metadata request fails.

## 8. Accessibility Requirements

- Meet WCAG 2.2 AA for applicable content and interactions.
- Maintain logical heading order and landmark structure.
- Provide a skip link and visible keyboard focus.
- Give every interactive product object an equivalent semantic control.
- Never rely on color, position, hover, or animation alone to convey state.
- Announce mode changes and clipboard results without stealing focus.
- Use accessible dialog behavior for the command palette.
- Support zoom to 200% and reflow without loss of content.
- Use meaningful alternative text; mark purely decorative imagery accordingly.
- Keep touch targets at least 44 by 44 CSS pixels where practical.
- Test high contrast and forced-colors behavior for essential controls.

## 9. Performance Budgets

- Primary content and navigation render without waiting for Three.js.
- Own compressed JavaScript target: less than 250 KB, excluding the conditionally loaded Three.js chunk.
- No autoplaying hero video.
- Responsive images use appropriate dimensions and modern formats with fallbacks.
- Below-the-fold images and product-world modules load lazily.
- Target smooth 60 FPS interaction on a representative modern desktop.
- Automatically reduce visual complexity if sustained performance drops materially below the target.
- Avoid layout shifts by reserving media dimensions.
- Lighthouse targets on the production build: Performance 90+, Accessibility 95+, Best Practices 95+, and SEO 95+ on representative desktop and mobile runs.

Budgets are release criteria, not justification for removing essential accessibility or content.

## 10. Validation Strategy

### Automated

- Type checking and production build.
- Content-schema validation, including duplicate identifiers and unsafe URLs.
- Existing link verification updated to evaluate the generated site.
- Browser tests for desktop, mobile, keyboard navigation, command palette, Story/Evidence switching, and contact fallback.
- Reduced-motion tests that assert continuous decorative animation is disabled.
- Tests with WebGL unavailable to confirm Tier B or Tier C recovery.
- Automated accessibility checks on the home page and representative product states.
- Screenshot comparisons for major breakpoints and presentation tiers.
- Lighthouse budget checks on the production artifact.

### Manual

- Chrome, Edge, Firefox, and Safari on current supported versions.
- iOS Safari and Android Chrome touch behavior.
- Keyboard-only journey from arrival through contact.
- Screen-reader spot checks for structure, product selection, evidence mode, and command palette.
- 200% zoom, forced colors, and slow-network loading.
- Validation of every existing CV, blog, product, social, and contact link.

## 11. Content and Security Constraints

- Do not invent customer counts, security results, revenue, usage metrics, affiliations, or production status.
- Evidence displayed as verified must have a real source or artifact.
- Do not expose private API keys, tokens, unpublished repository details, or local filesystem paths in source or built assets.
- The AIDesigner credential supplied during design discussion is not part of the website, specification, environment, or repository and must not be committed or rendered.
- External scripts require an explicit product reason and must not receive portfolio visitor data by default.
- Analytics, if added later, must be privacy-conscious and is outside this redesign's initial scope.

## 12. Migration and Rollout

1. Inventory existing routes, metadata, analytics if present, and publication workflows.
2. Introduce the modular build without changing public content behavior.
3. Implement the semantic Tier C experience first.
4. Add core layout, Product Worlds, evidence mode, and responsive behavior.
5. Add Tier B interactions.
6. Add the Tier A constellation and ambient effects.
7. Run automated and manual validation.
8. Compare the redesigned production artifact with the route inventory.
9. Deploy only after validation passes and rollback remains possible through the previous commit.

Existing uncommitted files and changes are user-owned. Implementation must not overwrite or absorb them without explicit relevance to the redesign.

## 13. Out of Scope

- A CMS or authenticated administration interface.
- User accounts, comments, or social features.
- A server-side application or database.
- Automatic sound or video-heavy cinematic sequences.
- Rewriting every historical article.
- Fabricating product demos or evidence.
- Dependence on AIDesigner or any external design service at runtime.

## 14. Acceptance Criteria

The redesign is ready for release when:

- The approved positioning and narrative sequence are present.
- The constellation and every Product World work at all applicable capability tiers.
- Story and Evidence modes show consistent data.
- The site remains fully usable with reduced motion, keyboard input, JavaScript failure, and WebGL failure.
- Existing public routes and workflows pass the route inventory.
- Automated accessibility, link, browser, visual, and performance checks pass.
- No private credential or unsupported claim appears in source or output.
- The current production experience can be restored through a normal Git revert or redeploy of the previous known-good commit.
