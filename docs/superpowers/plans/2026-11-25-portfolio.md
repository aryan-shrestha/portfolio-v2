# Portfolio v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Aryan Shrestha's freelance portfolio: a Next.js site whose home page is toured by a 3D, dithered cartoon of Aryan that moves between sections on scroll, narrates three project chapters, can be dragged, plays ~12 actions, and can be dressed up.

**Architecture:** Static Next.js App Router site. A framework-free character engine (`engine/`, plain Three.js) renders into one full-window canvas mounted once in the root layout and persists across routes; React talks to it only through `EngineAPI`. All maths that decide placement, containment, poses and narration are pure functions with unit tests; WebGL behaviour is verified in Playwright with pixel-edge checks.

**Tech Stack:** Node 25, Next.js 16.4.x, React 19, TypeScript (strict), Tailwind CSS 4.3.x, three 0.187.x, zod 4.x, gray-matter + next-mdx-remote 6.x (`/rsc`), sharp 0.35.x, Vitest 5.x, @playwright/test 1.65.x.

**Spec:** `docs/superpowers/specs/2026-11-25-portfolio-design.md` (v1.0, approved 2026-11-25). Section refs below (§n) point into it. **Reference implementation:** `.superpowers/brainstorm/25275-1795541050/content/scroll-tour-v12.html` (approved prototype: model, dither pass, placements, containment, poses, narration). Port from it; do not copy code from sebg.ch.

## Global Constraints

- Load skills before writing code: `vercel-react-best-practices` for every React/Next task; `impeccable` and `design-taste-frontend` for every task that changes UI.
- Next.js App Router, all routes statically generated; TypeScript `strict: true`; no React Three Fiber, no drei.
- Colour tokens exactly: paper `#f6f4ee`, ink `#111110`, accent `#e2462c`, grid-line `#e3dfd3` / `rgba(255,255,255,.08)` / `rgba(0,0,0,.07)`, muted `#5f5e58`; grid 40 px (§4.1).
- Display font Bricolage Grotesque 700–800, tracking −0.045em, heading line-height 0.9; body+mono fonts must not be Inter, Roboto, Geist, Space Grotesk, Plus Jakarta Sans or Fraunces (§4.2). Self-host via `next/font`.
- Copy: every project fact comes only from spec §6.3 and §6.6; every project says "Built at CloudProAI"; no invented metrics, quotes, dates or names. Character quips are written fresh, never copied from sebg (§7.4).
- No character pixel may touch the left, right or top viewport edge at any size, pose, outfit, or while dragged (badge excepted; bottom edge crop intended) (§7.5).
- `prefers-reduced-motion: reduce` and no-WebGL fallbacks per §7.7–7.8.
- Publish only the images and crops in §9; never publish `bevlytics-2.png`, `bevlytics-3.png`, `me.jpg`; strip EXIF.
- Budgets: initial JS excluding the engine chunk ≤ 120 KB gz; engine chunk ≤ 220 KB gz; Lighthouse mobile Performance ≥ 90; LCP ≤ 2.5 s (§10).
- Contact email `aryanshrestha274@gmail.com`; LinkedIn `https://www.linkedin.com/in/aryanshrestha274/`; GitHub `https://github.com/aryan-shrestha`.
- `localStorage` access always wrapped in try/catch; the site works without it.
- Repo: plain git, default branch `main`, work on `feat/portfolio`; ShipMint standards do not apply (§13).

## Review Focus

1. **Resize / rotate mid-page** (desktop window drag, phone rotation): placements recompute and nothing clips → test in Task 12 (`tour.spec.ts › resize mid-chapter`).
2. **Jumping instead of scrolling** ("Get in touch ↓" anchor, browser back to a scrolled position): character lands at the right placement without replaying every gesture in between → Task 9 (`placement.test.ts › jump`) and Task 12 (`tour.spec.ts › anchor jump`).
3. **Storage unavailable or corrupt** (private mode, stale JSON from an older look schema): dress-up, returning-visitor and look persistence fall back to defaults silently → Task 11 (`lookStore.test.ts`).
4. **Client-side navigation home → case page → back**: still exactly one canvas, no duplicated listeners or rAF loops, sections re-registered → Task 9 (`navigation.spec.ts`).
5. **Clipboard API missing or denied**: email still reachable (mailto link + visible address) and no unhandled rejection → Task 4 (`CopyEmail.test.tsx`).

---

## File Structure

```
app/
  layout.tsx                 fonts, tokens, <CharacterLayer/> (persists across routes)
  globals.css                tokens, grid utility, base type
  page.tsx                   home: Hero, About, Chapter×3, AllWork, Contact
  work/[slug]/page.tsx       case study (generateStaticParams over content)
  dress-up/page.tsx          dress-up page
  not-found.tsx              dress-up page + "doesn't exist" header
components/
  ui/Button.tsx  ui/BrowserFrame.tsx  ui/Bubble.tsx  ui/CopyEmail.tsx
  home/Hero.tsx  home/About.tsx  home/Chapter.tsx  home/ChapterScreen.tsx
  home/Diagram.tsx  home/AllWork.tsx  home/Contact.tsx
  work/CaseStudy.tsx
  character/CharacterLayer.tsx   client; lazy-loads engine, owns EngineAPI
  character/ActionMenu.tsx       poke/keyboard action menu
  character/StillFallback.tsx    static dithered image (no WebGL / reduced motion)
  dressup/DressUp.tsx
content/
  work/napa-valley-weddings.mdx  work/bevlytics.mdx  work/data-to-insights.mdx
  chapters.ts                    tints, outfits, narration lines, gestures, screens (§6.2–6.3)
lib/
  site.ts        email/links/name
  content.ts     zod schema + loaders for content/work
  narration.ts   activeLineIndex()
  dissolve.ts    bayer mask generation for screen dissolve
engine/          framework-free (no React imports)
  index.ts       createEngine(): EngineAPI
  types.ts       Look, Placement, PlacementKind, Action, Gesture, EngineAPI
  placement.ts   computePlacements, transitionProgress, smootherstep, placementAt
  contain.ts     containShift
  arms.ts        elbowTarget
  poses.ts       poseFor(action|gesture|drag, t, ctx)
  look.ts        DEFAULT_LOOK, SWATCHES, HAIR_STYLES, OUTFITS, parseLook
  lookStore.ts   loadLook/saveLook (storage-safe)
  model/build.ts buildCharacter(look) -> Rig
  model/hair.ts  model/outfits.ts
  render/dither.ts  createDitherPass(), accent flag channel, badge clip
  runtime.ts     frame loop: scroll placement, drag/spring, blink, look, bubble, handle
  quips.ts       all character copy
scripts/
  build-images.mjs   crops, EXIF strip, dithered covers → public/work/
  render-still.mjs   one-off: renders public/character/still.png from the engine
tests/
  unit/…  (vitest, node + jsdom)
  e2e/…   (playwright)
```

---

### Task 1: Repository, scaffold, tooling

**Files:**
- Create: Next.js app at repo root (`create-next-app`), `vitest.config.ts`, `playwright.config.ts`, `tests/unit/smoke.test.ts`, `tests/e2e/smoke.spec.ts`
- Modify: `.gitignore` (add `.superpowers/`, `test-results/`, `playwright-report/`)

**Interfaces:**
- Produces: `npm run dev|build|start|lint`, `npm run test` (vitest), `npm run e2e` (playwright against `next build && next start -p 3100`).

- [ ] **Step 1:** `git init -b main && git checkout -b feat/portfolio`. Run `npx create-next-app@16.4.6 . --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm` (keep existing `docs/`, `.claude/`, `.impeccable/`, `skills-lock.json`, `me.jpg`; add `me.jpg` to `.gitignore`).
- [ ] **Step 2:** `npm i three@0.187.0 zod@4.6.7 gray-matter next-mdx-remote@6.0.0` and `npm i -D vitest@5.1.1 @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event @playwright/test@1.65.1 sharp@0.35.5 @types/three`; `npx playwright install chromium`.
- [ ] **Step 3: Write smoke tests.** `tests/unit/smoke.test.ts`: `expect(1 + 1).toBe(2)`. `tests/e2e/smoke.spec.ts`: `GET /` returns 200 and has a `<main>`.
- [ ] **Step 4:** Configure `playwright.config.ts`: `webServer: { command: 'npm run build && npm run start -- -p 3100', port: 3100, reuseExistingServer: true }`, project `chromium` with `launchOptions.args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader']`. Configure vitest with `environment: 'node'` default, `jsdom` for `*.test.tsx`.
- [ ] **Step 5: Run** `npm run test && npm run e2e` → both PASS.
- [ ] **Step 6: Commit** `chore: scaffold Next.js app with vitest and playwright`.

---

### Task 2: Content layer and project data

**Files:**
- Create: `lib/site.ts`, `lib/content.ts`, `content/work/*.mdx` (3), `content/chapters.ts`, `engine/types.ts` (type-only for now: `OutfitId = 'hoodie'|'blazer-bowtie'|'hardhat'|'detective'`, `Gesture = 'wave'|'point'|'thumbs'|'think'|'cheer'`; Task 7 extends this file), `tests/unit/content.test.ts`

**Interfaces:**
- Produces:
  - `site: { name: 'Aryan Shrestha'; role: 'Full-stack developer'; email: string; linkedin: string; github: string; location: 'Kathmandu' }`
  - `WorkMeta` (zod-inferred): required `title, slug, year, builtAt ('CloudProAI'), myPart, stack: string[], liveUrl, tint, highlight, heroImage, problem, built`; optional `images: string[], diagram: 'napa' | 'bevlytics', outcomes: string`
  - `getAllWork(): Promise<WorkMeta[]>` (ordered Napa, Bevlytics, Data to Insights), `getWork(slug): Promise<{ meta: WorkMeta; source: string }>`, `parseWorkMeta(data: unknown): WorkMeta` (throws on invalid)
  - `chapters: ChapterData[]` where `ChapterData = { slug; side: 'left'|'right'; tint; fg; highlight; outfit: OutfitId; host; lines: { html: string; gesture: Gesture; screen: Screen }[] }`, `Screen = { kind: 'image'; src: string; alt: string } | { kind: 'diagram'; id: 'napa' | 'bevlytics' | 'bevlytics-cloudwatch' }`

- [ ] **Step 1: Write failing tests** in `tests/unit/content.test.ts`:
  - `parseWorkMeta` rejects an object missing `myPart` (throws).
  - `parseWorkMeta` accepts an object without `images`, `diagram`, `outcomes`.
  - `getAllWork()` returns slugs `['napa-valley-weddings','bevlytics','data-to-insights']`, every `builtAt === 'CloudProAI'`, and stacks exactly: Napa `['Next.js','Python','FastAPI']`, Bevlytics `['Python','AWS Lambda','Snowflake','CloudWatch']`, DTI `['NestJS','React','PostgreSQL','Zod','TanStack']`.
  - No work entry has `outcomes` (spec: none supplied).
  - `chapters` has 3 entries × 3 lines; sides `left,right,left`; tints `#24402d,#f6c9d8,#151413`; highlights `#8a6a1f,#b0144f,#c2410c`; gestures in order `wave,point,thumbs | wave,think,thumbs | wave,point,think`.
- [ ] **Step 2: Run** `npx vitest run tests/unit/content.test.ts` → FAIL (modules missing).
- [ ] **Step 3: Implement** `lib/site.ts`, `lib/content.ts` (gray-matter + zod 4 schema; read `content/work/*.mdx` with `fs` at build time), the three MDX files (frontmatter from §6.6 table; `problem` from the Product row; `built` = 2–4 first-person sentences restating only My part / Stack / Diagram; body may be empty), and `content/chapters.ts` with the nine lines verbatim from §6.3 (bold phrases as `<b>…</b>`), screens per §6.3 (image paths from Task 3's outputs).
- [ ] **Step 4: Run** tests → PASS.
- [ ] **Step 5: Commit** `feat: content schema, project data and chapter narration`.

---

### Task 3: Image pipeline (crops, EXIF, dithered covers)

**Files:**
- Create: `scripts/build-images.mjs`, `tests/unit/images.test.ts`, outputs in `public/work/` (committed)
- Modify: `package.json` (`"images": "node scripts/build-images.mjs"`)

**Interfaces:**
- Consumes: source dir `../portfolio/public/images/` (override with `SRC_DIR` env).
- Produces (all WebP, EXIF stripped, max width 2400):
  - `public/work/napa-hero.webp` ← `napa-valley-weddings.png` (full)
  - `public/work/bevlytics-hero.webp` ← `bevlytics.png` (full)
  - `public/work/dti-hero.webp` ← `data-to-insights.png` crop `{ left: 0, top: 0, width: 2938, height: 1480 }`
  - `public/work/dti-actions.webp` ← `data-to-insights-3.png` crop `{ left: 0, top: 105, width: 2940, height: 1460 }`
  - `public/work/dti-chat.webp` ← `data-to-insights-2.png` same crop
  - `public/work/cover-{slug}.png`: hero resized to 720×480 (cover, top), grayscale, 4×4 Bayer ordered dither at 1 cell = 2 px, dark dots = cover ink (`#24402d` Napa, `#b0144f` Bevlytics, `#151413` DTI), light = `#ffffff`

- [ ] **Step 1: Write failing tests** (`tests/unit/images.test.ts`, run after the script): each output exists; `dti-hero.webp` height ≤ 1480·(2400/2938) rounded; `sharp(file).metadata()` has no `exif`; `public/work/` contains no file whose name includes `bevlytics-2`, `bevlytics-3` or `me`; each cover PNG has exactly 2 distinct colours.
- [ ] **Step 2: Run** `npx vitest run tests/unit/images.test.ts` → FAIL.
- [ ] **Step 3: Implement** the script with sharp (`extract`, `resize`, `webp`, `.withMetadata()` omitted so EXIF is dropped); dither covers on the raw greyscale buffer with the Bayer matrix `[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5]` (threshold `(m+0.5)/16`).
- [ ] **Step 4: Run** `npm run images && npx vitest run tests/unit/images.test.ts` → PASS. Open `dti-actions.webp` and `dti-chat.webp` and confirm visually that no name or email is visible.
- [ ] **Step 5: Commit** `feat: image pipeline with privacy crops and dithered covers`.

---

### Task 4: Visual system and UI primitives

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`
- Create: `components/ui/Button.tsx`, `BrowserFrame.tsx`, `Bubble.tsx`, `CopyEmail.tsx`, `tests/unit/CopyEmail.test.tsx`

**Interfaces:**
- Produces:
  - CSS: tokens as CSS vars + Tailwind theme (`--color-paper` etc.), `.grid-bg` utility using `--gl`, `.display` class.
  - `<Button href? onClick? children/>` (pill, 1.5 px ink border, 4 px hard offset shadow, `white-space: nowrap`).
  - `<BrowserFrame host: string>{children}</BrowserFrame>` (3 dots, host pill, dotted 8 px offset shadow).
  - `<Bubble highlight?: string>{children}</Bubble>` (white, 2 px ink, radius 16; `b` uses `highlight`).
  - `<CopyEmail email: string onCopied?: () => void/>`: button showing the address; click copies; shows "Copied! Talk soon." for 2 s; always renders a `mailto:` link.

- [ ] **Step 1: Write failing tests** (`CopyEmail.test.tsx`): clicking calls `navigator.clipboard.writeText('aryanshrestha274@gmail.com')` and shows "Copied! Talk soon."; with `navigator.clipboard` undefined the click does not throw, no unhandled rejection, and a link `href="mailto:aryanshrestha274@gmail.com"` is present; when `writeText` rejects, same fallback.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** fonts (Bricolage Grotesque via `next/font/google`; choose body+mono per Global Constraints and record the choice in a comment in `layout.tsx`), tokens, primitives.
- [ ] **Step 4: Run** tests → PASS; `npm run lint` clean.
- [ ] **Step 5: Commit** `feat: visual tokens, fonts and UI primitives`.

---

### Task 5: Home page sections (static, no character)

**Files:**
- Create: `components/home/Hero.tsx`, `About.tsx`, `Chapter.tsx`, `ChapterScreen.tsx`, `Diagram.tsx`, `AllWork.tsx`, `Contact.tsx`, `lib/narration.ts`, `lib/dissolve.ts`, `tests/unit/narration.test.ts`, `tests/unit/dissolve.test.ts`, `tests/e2e/home.spec.ts`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `chapters`, `getAllWork()`, `site`, UI primitives.
- Produces:
  - Every section root carries `data-place` (`hero|left|right|badge|outro`), optional `data-outfit`, `data-gesture`; each narration line element carries `data-line` and `data-gesture`. These attributes are the engine's contract (Task 9).
  - `activeLineIndex(tops: number[], bottoms: number[], H: number, mobile: boolean): number` (−1 if none). Desktop: last line whose top ∈ [0.06H, 0.42H). Mobile: last line whose top < 0.6H and bottom > 0.56H + 110.
  - `bayerMask(level: number, cell: number): string` → data-URI SVG 4×4 pattern revealing cells with Bayer rank < level (level 0–16).
  - `ChapterScreen` dissolve: on screen change, overlay incoming screen and step `mask-image: bayerMask(0..16)` over 400 ms (16 steps); reduced motion → instant swap.
  - Hero copy, About copy, Contact copy and footer verbatim from §6.1. Phones: hero headline+sub at top of the section.
  - About: section 150svh with a sticky 100svh pin; words light up in order as `progress = clamp((−rect.top + 0.35H) / (rect.height − 0.4H), 0, 1)`; word i is on when `i / words < progress`; the phrase "frontends, APIs and data pipelines" lights in `accent`. Reduced motion → all words on.
  - `CopyEmail` in Contact dispatches `CustomEvent('email:copied')` on success.
  - `Diagram id`: `napa` (Browser → Next.js → FastAPI), `bevlytics` (distributor data → AWS Lambda (ETL) → Snowflake, CloudWatch beside Lambda), `bevlytics-cloudwatch` (same, CloudWatch in accent).

- [ ] **Step 1: Write failing unit tests:**
  - Desktop, H 900 (band [54, 378)): tops `[60, 500, 900]` → `0`; tops `[-300, 100, 500]` → `1`; tops `[-600, -300, 20]` → `-1` (bottoms irrelevant on desktop).
  - Mobile: H 844, tops `[300, 700]`, bottoms `[650, 1000]` → `0` (650 > 582.6); tops `[100]`, bottoms `[500]` → `-1`.
  - `bayerMask(0, 3)` reveals 0 cells, `bayerMask(16, 3)` reveals 16, `bayerMask(5,3)` reveals exactly the 5 cells with ranks 0–4.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** functions and components per spec §6.1–6.5 (layout and sizes as in the v12 prototype; chapter stage sticky 100svh; lines column on the character's side; browser frame opposite; All work grid 3→1 columns with `cover-{slug}.png` and links to `/work/[slug]`). A small client hook drives `.on/.past` classes via `activeLineIndex` on scroll and dispatches `CustomEvent('narration:line', { detail: { gesture } })` on activation.
- [ ] **Step 4: Write e2e** `home.spec.ts`: sections in order hero, about, 3 chapters, work, contact; each chapter shows its three lines' text; at 1440×900 and 390×844, scrolling through every chapter never shows more than one `.line.on`; "Copied! Talk soon." appears after clicking the email (grant clipboard permission); no console errors.
- [ ] **Step 5: Run** unit + e2e → PASS.
- [ ] **Step 6: Commit** `feat: home page sections, narration and screen dissolve`.

---

### Task 6: Case-study pages

**Files:**
- Create: `app/work/[slug]/page.tsx`, `components/work/CaseStudy.tsx`, `tests/e2e/work.spec.ts`

**Interfaces:**
- Consumes: `getAllWork`, `getWork`, `Diagram`, `BrowserFrame`.
- Produces: static routes for the 3 slugs; section root `data-place="right"` with `data-case-comment` (quip id) for Task 9; desktop right gutter width `calc(var(--char-s) * 0.85 * 3.5)` where `--char-s` is set by the engine (fallback 100 px).

- [ ] **Step 1: Write failing e2e:** each page shows title, "Built at CloudProAI", My part text from §6.6, stack pills exactly as Task 2, live link with `target="_blank" rel="noopener"`; Napa and Bevlytics render no "more images" block; Data to Insights renders `dti-actions` and `dti-chat`; no page contains the word "Outcomes"; "Next project →" cycles Napa → Bevlytics → DTI → Napa; unknown slug → 404.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** with `generateStaticParams`, `dynamicParams = false`, `compileMDX` from `next-mdx-remote/rsc` for the body, `next/image` for screenshots, `generateMetadata` per page.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: case-study pages`.

---

### Task 7: Engine maths — placements, transitions, containment, arms

**Files:**
- Create: `engine/types.ts`, `engine/placement.ts`, `engine/contain.ts`, `engine/arms.ts`, `tests/unit/placement.test.ts`, `tests/unit/contain.test.ts`, `tests/unit/arms.test.ts`

**Interfaces:**
- Produces:
  - `type PlacementKind = 'hero'|'outro'|'left'|'right'|'badge'|'stage'`; `type Placement = { x: number; y: number; S: number; talk: 0|1; badge: 0|1; cx?: number; cy?: number }` (CSS px from window centre, y up).
  - `BOX = { x0: -2.6, x1: 2.6, y1: 3.05 }` (y1 replaced by Task 11's measured value), `WIDEST_TOTAL = 5.75`.
  - `computePlacements(W: number, H: number, opts?: { copyBottom?: number }): Record<PlacementKind, Placement>` — formulas exactly as spec §6.1 table (desktop `W > 900`); phone hero additionally capped so silhouette top ≥ `copyBottom + 12`; `stage` = centred, sized to fit `WIDEST_TOTAL` and `BOX.y1` with 24 px margins.
  - `smootherstep(t: number): number`; `transitionProgress(scrollY: number, H: number, sectionTop: number): number` = `clamp((scrollY + 0.95H − top)/(0.75H), 0, 1)`.
  - `placementAt(scrollY: number, H: number, sections: { top: number; kind: PlacementKind }[], P: Record<PlacementKind, Placement>): { st: Placement & { b: number }; current: number }`.
  - `containShift(bounds: { minX; maxX; maxY }, W: number, H: number, pad: number): { dx: number; dy: number }`.
  - `elbowTarget(shoulderAngle: number, shoulderTarget: number, gestureElbow: number, side: -1|1): number` — fold `1.6·sin|θ|` only while `|θ − target| > 0.35`.

- [ ] **Step 1: Write failing tests** (values from the spec):
  - `computePlacements(1440, 900).hero.S` ≈ `min(0.86*900/4.25, 0.42*1440/5.2)` = `116.31` (±0.01); hero right edge `hero.x + 2.6*S === 720 - 43.2`; `left.S === 0.85*hero.S`; `badge` circle diameter 160, centre `(-720+24+80, -450+24+80)`.
  - `computePlacements(390, 844).hero.S` ≈ `min(0.42*844/4.55, 366/5.75)` = `63.65`; `hero.x === 0`; `left.S === 0.62*hero.S`; badge diameter 112.
  - With `copyBottom: 600` at 390×844 the hero silhouette top (`H/2 − (hero.y + 3.05·S)` in screen px) is ≥ 612.
  - `transitionProgress(0, 900, 900) === ~0.0` (scrollY+855−900 <0 → 0); `transitionProgress(720, 900, 900)` = clamp(675/675) = 1.
  - `smootherstep(0)=0, (0.5)=0.5, (1)=1`.
  - **jump**: `placementAt` for a scrollY deep in the contact section returns `outro` values exactly and `current` = index of contact, regardless of sections in between.
  - `containShift({minX:-730,maxX:-300,maxY:0}, 1440, 900, 8).dx === 18`; wider than viewport → centres; `maxY` above `H/2 - pad` → negative `dy`.
  - `elbowTarget(Math.PI/2, 2.55, -0.3, -1)` magnitude 1.6 (swinging); `elbowTarget(2.55, 2.55, -0.3, -1) === -0.3` (arrived).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): placement, transition and containment maths`.

---

### Task 8: Engine model and dither pass

**Files:**
- Create: `engine/look.ts`, `engine/model/build.ts`, `engine/model/hair.ts` (default style only here), `engine/render/dither.ts`, `tests/unit/model.test.ts`

**Interfaces:**
- Produces:
  - `type Look = { base: { hair: HairStyle; hairColor: string; skin: string; hoodie: string; glasses: boolean }; outfit: OutfitId }`; `DEFAULT_LOOK` = wavy-fringe, `#3a2f28`, `#efc6a2`, `#55555c`, glasses false, outfit `hoodie`; `SWATCHES`, `HAIR_STYLES`, `OUTFITS` exactly as §7.6.
  - `type Rig = { root: Group; body: Group; head: Group; face: Group; arms: [Arm, Arm]; eyes: { smile: Group; open: Group }; mouth: { smile: Mesh; open: Mesh }; slots: { hat: Group; neck: Group; hands: [Group, Group] } ; bubbleAnchor: Object3D; handleParts: Object3D[] }`, `Arm = { shoulder: Group; elbow: Group; side: -1|1 }`.
  - `buildCharacter(look: Look): Rig` — geometry/proportions ported from v12 (`// character model` block). Accent parts (drawstrings) set `mesh.userData.accent = true`.
  - `createDitherPass(renderer): { render(scene, camera, opts: { px: number; clip?: { cx: number; cy: number; r: number } }): void; resize(W, H, px): void }` — scene renders to a nearest-filtered RT; accent meshes write alpha 0.5 (normal 1.0, background 0); post shader: alpha < 0.25 discard, alpha < 0.75 → accent/white dither (`lv = clamp(l*0.75−0.12)`), else ink/white; luminance and 4×4 Bayer exactly as v12; circular clip discards outside `r`.

- [ ] **Step 1: Write failing tests** (node env, no renderer): `buildCharacter(DEFAULT_LOOK)` returns a rig with 2 arms whose `side`s are `-1` and `1`; exactly 2 meshes with `userData.accent` and they sit under the neck/torso; changing `base.hoodie` changes the torso material colour but not the accent flags; `Box3.setFromObject(rig.root, true)` at rest spans x ⊂ [−1.8, 1.8], top ≤ 3.05.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(engine): character model and dither pass with accent channel`.

---

### Task 9: Engine runtime, React bridge, persistence across routes

**Files:**
- Create: `engine/runtime.ts`, `engine/index.ts`, `engine/quips.ts`, `components/character/CharacterLayer.tsx`, `tests/e2e/character.spec.ts`, `tests/e2e/navigation.spec.ts`
- Modify: `app/layout.tsx` (mount `<CharacterLayer/>`)

**Interfaces:**
- Consumes: Tasks 7–8; DOM contract from Task 5/6 (`data-place`, `data-outfit`, `data-gesture`, `narration:line` event, `data-case-comment`).
- Produces `EngineAPI` (exact):
  ```ts
  interface EngineAPI {
    mount(canvas: HTMLCanvasElement, handle: HTMLElement, bubble: HTMLElement, badge: HTMLElement): void;
    setSections(els: HTMLElement[]): void;          // re-read on every route change
    play(action: Action): void; gesture(g: Gesture): void;
    say(text: string, ms?: number): void;
    setLook(base: Look['base']): void; setOutfit(id: OutfitId, priority?: 'visitor' | 'chapter'): void;
    onPoke(cb: () => void): () => void;
    debugState(): { minX: number; maxX: number; top: number; S: number; placement: PlacementKind; outfit: OutfitId; action: Action | Gesture | null }; // exposed as window.__engine in non-production and in e2e builds (NEXT_PUBLIC_E2E=1)
    destroy(): void;
  }
  export function createEngine(): EngineAPI;
  ```
- `CharacterLayer` (client): renders canvas/handle/bubble/badge once; loads `engine` via dynamic `import()` inside `requestIdleCallback` (timeout 2000); on `usePathname()` change calls `setSections` with the new page's `[data-place]` elements; sets CSS var `--char-s` on `<html>`; listens for `narration:line` → `gesture()` and `email:copied` → `say('Copied! Talk soon.', 2500)`; case pages: says the `data-case-comment` quip, then after 4 s or first scroll switches that page's placement to `badge`.

- [ ] **Step 1: Write failing e2e** (`NEXT_PUBLIC_E2E=1` build):
  - `character.spec.ts`: canvas appears within 4 s of load; hero bubble text "Hi, I'm Aryan. Scroll down and I'll show you around." (with `Aryan` bolded); scrolling to the contact section changes it to "Got something to build? Say hi."; dragging the handle 300 px left then releasing returns `debugState().minX` to within 2 px of its pre-drag value after 1.5 s.
  - `navigation.spec.ts`: home → click a "View project" → case page → `page.goBack()`; afterwards `document.querySelectorAll('canvas').length === 1`, `debugState().placement` matches the section in view, and no console errors.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the runtime by porting the v12 `tick()` loop: scroll placement (`placementAt`), drag + critically damped spring (k=60, c=11), blink 2–5 s, cursor look (yaw ±0.5, pitch ±0.3), travel head-turn, `containShift` **after** the final pose each frame (skip when `b > 0.01`), badge clip + ring opacity, handle box from skull/torso/hair, bubble anchored above-left of head and clamped on screen, pause rAF when `document.hidden`. Section gestures fire only when `current` changes by exactly one step (a jump of > 1 section plays only the destination's gesture). Engine chunk must not be imported by any server component.
- [ ] **Step 4: Run** e2e → PASS.
- [ ] **Step 5: Commit** `feat(engine): runtime, React bridge and route persistence`.

---

### Task 10: Actions, gestures, action menu, quips

**Files:**
- Create: `engine/poses.ts`, `components/character/ActionMenu.tsx`, `tests/unit/poses.test.ts`, `tests/e2e/actions.spec.ts`
- Modify: `engine/runtime.ts` (use `poseFor`), `engine/quips.ts`

**Interfaces:**
- Produces:
  - `type Action = 'wave'|'dance'|'panic'|'fly'|'vanish'|'hiccup'|'peekaboo'|'selfie'|'dizzy'|'sneeze'|'sulk'|'deploying'`; `type Gesture = 'wave'|'point'|'thumbs'|'think'|'cheer'`.
  - `DURATION: Record<Action|Gesture, number>` (all within 1.5–4 s).
  - `poseFor(kind: Action|Gesture|'drag'|'idle', t: number, ctx: { side: -1|1; now: number; dragVx?: number }): PoseTarget` where `PoseTarget = { sh: [number, number]; el: [number, number]; bodyZ; bodyY; headZ; headX; open: boolean; wide: boolean; rootY?: number; visible?: number }` (`rootY` for fly, `visible` 0–1 for vanish dither-out).
  - Ported poses from v12: wave, dance, panic, think, point (arm on screens' side), thumbs, cheer, drag (arms flail upward). New: fly, vanish, hiccup, peekaboo, selfie, dizzy, sneeze, sulk, deploying.
  - `ActionMenu`: opens on `engine.onPoke`, and from a visible "Play with me" button (fixed, near the character, keyboard-focusable); lists the 12 actions; Escape closes; selecting plays and closes.
  - `quips.ts`: every line the character says (hero, outro, drag, drop, poke, per-action reaction, mobile-mode, returning visitor, 3 case comments incl. "The data had opinions."). Approved lines from §7.4 included verbatim.

- [ ] **Step 1: Write failing tests** (`poses.test.ts`): every Action/Gesture has a `DURATION` in [1.5, 4]; `poseFor(x, DURATION[x] + 0.01, ctx)` equals `poseFor('idle', …)` for arms; `point` with `side: 1` raises arm index 1, with `side: -1` arm index 0; drag pose has both `|sh| ≥ 2.0` (arms up). `actions.spec.ts`: clicking the character (no drag) opens the menu with 12 items; Tab to "Play with me", Enter opens, Escape closes and focus returns to the button; choosing "dance" changes `debugState()` over the next second.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: full action set, gestures and action menu`.

---

### Task 11: Outfits, hair styles, dress-up, 404, measured bounds

**Files:**
- Create: `engine/model/outfits.ts`, extend `engine/model/hair.ts`, `engine/lookStore.ts`, `components/dressup/DressUp.tsx`, `app/dress-up/page.tsx`, `app/not-found.tsx`, `tests/unit/lookStore.test.ts`, `tests/unit/bounds.test.ts`
- Modify: `engine/placement.ts` (`BOX.y1` = measured), `engine/runtime.ts` (chapter outfit priority)

**Interfaces:**
- Produces:
  - `applyOutfit(rig: Rig, id: OutfitId): void`, `applyHair(rig: Rig, style: HairStyle, color: string): void` — outfits per §6.2 (blazer + vermilion bow tie (accent-flagged), yellow hard hat + wrench, detective hat + magnifying glass); hair styles per §7.6.
  - `loadLook(storage?: Storage): Look` / `saveLook(look: Look, storage?: Storage): void` — `parseLook` validates; invalid/unavailable → `DEFAULT_LOOK`.
  - `measureBounds(look: Look, kinds: (Action|Gesture|'idle'|'drag')[], samples = 40): { x0; x1; y1 }` — headless (node) sweep using `poseFor` + `Box3.setFromObject(…, true)`.
  - Outfit priority: `setOutfit(id, 'chapter')` overrides the visitor outfit until the chapter is left; base traits always the visitor's. The swap happens when the transition progress into/out of a chapter crosses 0.5 (mid-slide), never at the section edge.
- `/dress-up`: placement `stage`; controls for every §7.6 option; Reset; saves via `saveLook`; `not-found.tsx` renders `DressUp` under the header "This page doesn't exist — but you can dress me up".

- [ ] **Step 1: Write failing tests:**
  - `lookStore.test.ts`: storage whose `getItem` throws → `DEFAULT_LOOK`; stored `"not json"` → default; stored object with unknown hair style → default; valid round-trip preserved.
  - `bounds.test.ts`: for every `HAIR_STYLES` × `OUTFITS` with kinds `['idle','wave','dance','panic','drag']`: `x1 − x0 ≤ WIDEST_TOTAL` and `y1 ≤ BOX.y1` (after updating `BOX.y1` to the measured max, rounded up to 0.05). This test fails whenever a new pose/outfit escapes the bounds.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; set `BOX.y1` from the measurement. **Step 4: Run** → PASS.
- [ ] **Step 5: e2e addition** (`actions.spec.ts`): on `/dress-up`, pick hair `curly-top`, outfit `detective`, reload → choices persist; visit `/missing` → 404 status and the dress-up header; on the home page with a visitor outfit `hardhat`, chapter 1 shows outfit `blazer-bowtie` (`debugState().outfit`), and the about section shows `hardhat`.
- [ ] **Step 6: Commit** `feat: outfits, hair styles, dress-up page and measured bounds`.

---

### Task 12: Fallbacks and regression suites (clip, tour, budgets)

**Files:**
- Create: `scripts/render-still.mjs`, `public/character/still.png`, `components/character/StillFallback.tsx`, `tests/e2e/clip.spec.ts`, `tests/e2e/tour.spec.ts`, `tests/e2e/fallbacks.spec.ts`, `tests/e2e/budget.spec.ts`
- Modify: `components/character/CharacterLayer.tsx`

**Interfaces:**
- Consumes: `window.__engine.debugState()`, `EngineAPI.play`.
- Produces: fallbacks per §7.7–7.8 (no WebGL → `StillFallback` at hero/outro and badge; reduced motion → still image, no scroll choreography, narration as plain text, menu actions show a single still pose); mobile-mode quip at the 900 px crossing; returning-visitor greeting via `loadLook`-style safe storage.

- [ ] **Step 1: Write the suites** (edge check = scan screenshot columns 0 and W−1 and row 0 for pure-white `#ffffff`, ink `<30,30,30`, or vermilion pixels, with `.bubble`, header text and nav hidden via injected CSS; badge state excluded):
  - `clip.spec.ts`: viewports 1920×1080, 1440×900, 1280×600, 1024×768, 768×1024, 390×844, 360×640 × {idle, each of 12 actions mid-play, drag via mouse to each corner and 300 px beyond, dance pinned to left and right edge}: zero edge pixels.
  - `tour.spec.ts`: viewports 1440×900, 1280×600, 1024×768, 768×1024, 390×844 × 31 evenly spaced scroll positions: zero edge pixels (`debugState` bounds inside viewport when `placement !== 'badge'`), ≤ 1 `.line.on`; placement sequence hero → left → left → right → left → badge → outro. **resize mid-chapter**: at chapter 2 resize 1440×900 → 390×844 → zero edge pixels after 500 ms. **anchor jump**: click "Get in touch ↓" → within 1.5 s `placement === 'outro'`.
  - `fallbacks.spec.ts`: `reducedMotion: 'reduce'` → `still.png` visible, scrolling does not move it, narration text visible; WebGL disabled (`--disable-webgl`) → still image, no console errors; returning visit shows the "back" greeting; crossing 900 px width says the mobile quip.
  - `budget.spec.ts`: on first load of `/` (cold, cache disabled), sum gzip transfer sizes of JS requests excluding the engine chunk (`/_next/static/chunks/*engine*` — name the dynamic import chunk `engine` via `webpackChunkName` or check by import origin) ≤ 120 KB; engine chunk ≤ 220 KB.
- [ ] **Step 2: Run** → FAIL where unimplemented. **Step 3: Implement** fallbacks and `render-still.mjs` (Playwright renders the engine at hero idle to a 600 px transparent PNG; committed). **Step 4: Run** `npm run e2e` → all PASS.
- [ ] **Step 5: Lighthouse:** `npx lighthouse http://localhost:3100 --preset=perf --form-factor=mobile --quiet --chrome-flags="--headless"` → Performance ≥ 90, LCP ≤ 2.5 s. Record the numbers in the commit message.
- [ ] **Step 6: Commit** `test: clip, tour, fallback and budget regression suites`.

---

### Task 13: Finish review and launch prep

**Files:**
- Create: `README.md` (run, test, image pipeline, where content lives, how to add a project)
- Modify: `app/layout.tsx` (metadata, OG image = dithered character still on paper with the headline), `app/sitemap.ts`, `app/robots.ts`

- [ ] **Step 1:** Run `/impeccable` audit on the built site and `design-taste-frontend`'s checker/finish gate; fix every material finding (contrast, focus rings on all tints, spacing). Keyboard-only pass: every link, the email button, "Play with me", menu, dress-up controls.
- [ ] **Step 2:** Copy check against spec: every project fact matches §6.3/§6.6; "Built at CloudProAI" on all three; no "Outcomes"; no copied sebg lines.
- [ ] **Step 3:** Privacy check: `grep -ri "cloudproai.com\|@cloudp\|kuinkel\|NINKASI" public/ app/ content/ components/` → no matches; open every published image.
- [ ] **Step 4:** `npm run lint && npm run test && npm run e2e` → all PASS.
- [ ] **Step 5: Commit** `chore: metadata, README and finish fixes`. Deployment to Vercel and the domain are the owner's call — prepare, do not deploy without an explicit go.
