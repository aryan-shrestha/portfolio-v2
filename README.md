# Portfolio v2 — Aryan Shrestha

A one-page portfolio toured by a 3D, ordered-dithered cartoon of Aryan, plus three case-study pages and a
dress-up page. Next.js 16 (App Router, every route static), React 19, TypeScript strict, Tailwind CSS v4,
plain Three.js (no React Three Fiber). README version 1.0, 2026-11-25.

| | |
|---|---|
| Spec (binding) | [`docs/superpowers/specs/2026-11-25-portfolio-design.md`](docs/superpowers/specs/2026-11-25-portfolio-design.md), v1.1. Its Changelog lists every ruling that changed it |
| Implementation plan | [`docs/superpowers/plans/2026-11-25-portfolio.md`](docs/superpowers/plans/2026-11-25-portfolio.md) |
| Build rulings and notes | `.superpowers/sdd/2026-11-25-portfolio/progress.md` (R1–R20, N1–N15) and `constraints.md`; task briefs and reports sit beside them. `.superpowers/` is git-ignored: it lives in the working copy only |
| Approved prototypes | `.superpowers/brainstorm/25275-1795541050/content/character-prototype-v10.html`, `scroll-tour-v12.html` |

## Run

Node 20.9 or newer (Next 16's minimum).

```bash
npm install
npm run dev                      # http://localhost:3000
npm run build && npm run start   # production build; `next build` must list every route as ○ or ●
```

Environment:

| Variable | Use |
|---|---|
| `SITE_URL` | Canonical origin for metadata, `sitemap.xml` and `robots.txt`, e.g. `https://example.com`. The domain is still open (spec §12). Unset: a Vercel build uses `VERCEL_PROJECT_PRODUCTION_URL`, a local build `http://localhost:3000` |
| `NEXT_PUBLIC_E2E=1` | Exposes `window.__engine` (debug hooks) for Playwright and the render scripts. Never set it for the live site |

## Test

```bash
npm run lint          # ESLint
npm run test          # Vitest: placement maths, containment, pose bounds, content schema, images, stores
npm run e2e           # Playwright (Chromium, WebGL through SwiftShader), about 5–6 min
```

`npm run e2e` builds with `NEXT_PUBLIC_E2E=1` and serves on port 3100, or reuses a server already there.
A stale server from another build gives misleading results, so stop it first:

```bash
lsof -ti :3100 | xargs kill
```

What the suites cover (spec §10): clip regression at 7 viewports, sampled every frame (`clip.spec`,
`actions.spec`, `tests/e2e/sampling.ts`); the slide into and out of the badge, per frame (`boundary.spec`,
ruling R20); the scroll tour (`tour.spec`); reduced-motion and no-WebGL
fallbacks (`fallbacks.spec`); dress-up (`dressup.spec`); case pages (`work.spec`); the JS budget
(`budget.spec`: app-owned initial JS ≤ 30 KB gz, total ≤ 160 KB gz, engine ≤ 220 KB gz).

## Where things live

| Path | What |
|---|---|
| `app/` | Routes: `/`, `/work/[slug]`, `/dress-up`, the 404 (the dress-up page), `sitemap.ts`, `robots.ts`, `icon.png`, `apple-icon.png`; metadata in `layout.tsx` |
| `content/work/*.mdx` | One case study per file. The frontmatter is the data (schema in `lib/content.ts`, Zod: a missing or invalid field fails the build); the MDX body is optional extra copy under "What I built" |
| `content/chapters.ts` | The home page chapters: tint, outfit, host pill, narration lines with gesture and screen |
| `lib/content.ts` | Loader, schema and the project order (`ORDER`) |
| `lib/site.ts`, `lib/siteUrl.ts` | Contact links; canonical origin and share image |
| `components/` | `home/` sections, `work/CaseStudy.tsx`, `dressup/`, `character/` (the layer, action menu, still fallback), `ui/` primitives |
| `engine/` | The character: model, poses, placement maths, containment, dither pass, runtime. `engine/quips.ts` holds every line he says |
| `public/work/` | Published screenshots (`*-hero.webp`, DTI extras) and dithered covers (`cover-*.png`) |
| `public/character/still.png` | The no-WebGL still of him |
| `public/og.png` | The share image (1200 × 630) |

## Image pipeline

Source screenshots live outside the repo, in the owner's previous site (`../portfolio/public/images/`).
Only the files listed in spec §9 are published; `bevlytics-2.png`, `bevlytics-3.png` and `me.jpg` never are.

```bash
npm run images                         # scripts/build-images.mjs; SRC_DIR=… to point elsewhere
```

It writes `public/work/*.webp` (2400 px wide, EXIF stripped, the privacy crops from spec §9) and the
dithered, tinted covers `public/work/cover-*.png` (720 × 480, two colours). `tests/unit/images.test.ts`
checks sizes, colours and that no excluded file is published. Look at every output image before committing.

Rendered from the running site (start an e2e build first: `NEXT_PUBLIC_E2E=1 npm run build && npm run start -- -p 3100`):

```bash
npm run still                          # public/character/still.png, from the real engine
npm run og                             # scripts/render-og.mjs: public/og.png, app/icon.png, app/apple-icon.png
```

## Add a project

1. **Images.** Add the source to `heroes` (and any extra screens to `extras`) in `scripts/build-images.mjs`,
   with a crop that removes any personal or client data, and run `npm run images`. Open every output.
   Add the cover name to `covers` in `tests/unit/images.test.ts`.
2. **Case study.** Create `content/work/<slug>.mdx` with the required frontmatter: `title, slug, year,
   builtAt, myPart, stack, liveUrl, tint, highlight, heroImage, problem, built` (optional: `images`,
   `diagram`, `outcomes`). Facts only, from the owner. Note `builtAt` is `z.literal('CloudProAI')` in
   `lib/content.ts`: a project built elsewhere needs that schema widened first.
3. **Wiring.** Add the slug to `ORDER` in `lib/content.ts`; its cover to `COVERS` in
   `components/home/AllWork.tsx`; the screenshot sizes to `SIZES` in `components/work/CaseStudy.tsx`; a
   case-page comment to `engine/quips.ts` (no factual claims). A new diagram is an SVG in
   `components/home/Diagram.tsx` plus an id in the schema's `diagram` enum.
4. **Home chapter (optional).** Add an entry to `content/chapters.ts` (side, tint and text colour with AA
   contrast, a highlight darkened for AA on white, an outfit, three lines with gestures and screens). A new
   outfit must be measured against the containment bounds (spec §7.5–7.6; `tests/unit/bounds.test.ts`).
5. **Check.** `npm run lint && npm run test && npm run e2e`; `next build` lists the new `/work/<slug>` as ●.

## Deploy

Not deployed. Hosting is Vercel (spec §10); the domain and the go-live are the owner's call. Set
`SITE_URL` once the domain exists.
