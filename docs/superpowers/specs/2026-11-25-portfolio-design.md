# Portfolio v2 — Design

| | |
|---|---|
| Date | 2026-11-25 |
| Version | 1.2 (approved 2026-11-25 as 1.0; amended at the build finish and after, see Changelog) |
| Owner | Aryan Shrestha |
| Inspiration | https://www.sebg.ch/ (behaviour studied and measured; no code, art, or copy taken) |
| Approved prototypes | `.superpowers/brainstorm/25275-1795541050/content/character-prototype-v10.html` (character), `scroll-tour-v12.html` (page choreography) |

Labels used below: **[decided]** = the owner chose it in the brainstorm; **[call]** = designer's call, open to correction; **[builder]** = left to the builder.

---

## 1. Intent

A personal portfolio that wins **freelance clients** and shows Aryan's projects and skills. The hook is a 3D, dithered cartoon of Aryan that walks the visitor through the page, in the spirit of sebg.ch: the character moves between sections as you scroll, narrates each project, reacts when grabbed or poked, and can be dressed up.

The site must read, within one screen, as: *a full-stack developer who builds whole products (frontend, backend, data) and is available for work.*

### Goals
1. A client understands what Aryan builds and sees proof (3 projects) within one scroll.
2. Contacting him takes one click (copy email).
3. The character is memorable and polished: it never clips, never stutters, and never blocks reading.
4. Fast: the page is readable before the character loads.

### Non-goals
- Blog, CMS, analytics, sound effects (sebg has sound; not in scope), contact form, i18n.
- More than the 3 listed projects at launch (the "All work" grid is built to grow).

### Anti-goals (fail even if it "works")
- Looks or reads like a clone of sebg.ch (same character, lines, layout pixel-for-pixel, or copied code/assets).
- Any part of the character is cut off by a screen edge (left, right, top) at any size, pose, or while dragged. The bottom edge cropping his torso is intended. [decided]
- Overstating Aryan's role: the projects were built **at CloudProAI**; each says so and states only his part. [decided]
- Publishing private or client data in screenshots (see §9).

---

## 2. Constraints

- **Framework:** Next.js (App Router), TypeScript. [decided]
- **Character tech:** plain Three.js module, not React Three Fiber, not sprites (Approach A). [decided]
- **No clipping** (anti-goal above) is a hard, tested requirement.
- **Reduced motion:** respect `prefers-reduced-motion` (see §7.8).
- **Facts:** every claim about a project comes from §6.3. No invented metrics, dates, quotes, or client names beyond those listed.
- **Permission:** owner confirmed permission to show all three projects publicly with names, screenshots and links. [decided]
- **No phone screenshots are available**, and napavalleyweddings.com blocks automated capture (Cloudflare challenge; do not attempt to bypass it). [decided]

---

## 3. Approaches considered

| | Approach | Trade-off | Outcome |
|---|---|---|---|
| **A** | Next.js + a self-contained plain **Three.js** "character engine" mounted once in the root layout; React talks to it through a small imperative API | Not React-idiomatic inside the engine, but the character is a per-frame imperative loop; smallest overhead; the prototypes are already this | **Chosen** [decided] |
| B | Next.js + React Three Fiber / drei | Familiar React style, but every per-frame movement goes through refs anyway; +~40–50 KB gz; dither pass must be rebuilt in the effects pipeline | Rejected |
| C | Pre-rendered dithered sprite sheets | Lightest runtime, but loses live head-follow, drag physics, edge containment and the dress-up page | Rejected |

---

## 4. Visual system

### 4.1 Colour tokens [decided]
| Token | Value | Use |
|---|---|---|
| `paper` | `#f6f4ee` | page background |
| `ink` | `#111110` | text, character dark dots, outlines |
| `accent` (vermilion) | `#e2462c` | the word "whole" in the hero, character's hoodie drawstrings, links/hover, badge ring |
| `grid-line` | `#e3dfd3` (on paper) / `rgba(255,255,255,.08)` (on dark) / `rgba(0,0,0,.07)` (on light tints) | 40 px square grid on every section |
| `muted` | `#5f5e58` | secondary text (≥ 4.5:1 on paper) |

Chapter tints are in §6.2. All text must meet WCAG AA against its background (highlight colours in bubbles are already darkened for this: Napa gold `#8a6a1f`, Bevlytics magenta `#b0144f`, Data to Insights orange `#c2410c`, all on white).

### 4.2 Type
- **Display:** Bricolage Grotesque, 700–800, tight tracking (−0.045em), line-height 0.9 for headings. [decided]
- **Body + mono:** [builder] pick a distinctive pairing (not Inter, Roboto, Geist, Space Grotesk, Plus Jakarta Sans, Fraunces). Body line-height 1.5. Self-host via `next/font`.
- Speech-bubble text uses the display face at 700, line-height ~1.15 (short display text, intentional).

### 4.3 Surfaces
- Buttons/pills: 1.5 px ink border, fully rounded, hard offset shadow (4 px, no blur) — intentional.
- Browser-window frames: white window, 3 dots, centred host pill, **dotted** offset shadow (4 px dot pattern, 8 px offset).
- Speech bubbles: white, 2 px ink border, radius 16, offset shadow.

---

## 5. Site map

| Route | Content |
|---|---|
| `/` | Hero → About → 3 project chapters → All work → Contact (§6) |
| `/work/[slug]` | Case-study page × 3: `napa-valley-weddings`, `bevlytics`, `data-to-insights` (§6.6) |
| `/dress-up` | Dress-up page (§7.6) |
| not-found | Renders the dress-up page with a "This page doesn't exist — but you can dress me up" header (sebg's 404 = dress-up pattern) [call] |

The character layer lives in the root layout and **persists across route changes** (no reload, no re-entry animation between pages).

---

## 6. Home page

### 6.1 Sections and character placement

The character sits in a fixed, full-window layer. Each section declares a **placement**; moving between sections is **scrubbed by scroll** (not timed) and eased slow-fast-slow (smootherstep), so scrolling back plays it in reverse. Measured on sebg and approved in prototype v12. [decided]

| # | Section | Placement | Character | Speech |
|---|---|---|---|---|
| 1 | **Hero** — name + "Full-stack developer" top-left, "Get in touch ↓" top-right; headline "I build the *whole* thing." + sub "Frontend, backend and the data in between. Freelance full-stack developer in Kathmandu." | `hero` | big, bottom-right (desktop) / bottom-centre (phone); waves on load | attached bubble: "Hi, I'm **Aryan**. Scroll down and I'll show you around." |
| 2 | **About** — 150 svh tall, sticky; text on the right lights up word by word with scroll | `left` | bottom-left, smaller | none |
| 3–5 | **Project chapters** (§6.2) | `left` / `right` / `left` | slides across between chapters, head turned toward travel direction; outfit per chapter | narration lines in page (§6.3) |
| 6 | **All work** — heading, "3 projects", grid of covers | `badge` | shrinks into a round badge bottom-left (circular clip, vermilion ring); cheers on entry | none |
| 7 | **Contact** — dark (`ink`) section: "Got a project?", "I'm taking on new work.", big email `aryanshrestha274@gmail.com` (click to copy → "Copied! Talk soon."), footer: © 2026 Aryan Shrestha · LinkedIn · GitHub · Dress me up | `outro` (= hero) | grows back to hero size bottom-right; waves | attached bubble: "Got something to build? **Say hi.**" |

**Phones: he never covers reading text.** [call] In the hero/outro on ≤ 900 px, the headline and sub-line sit at the **top** of the section and the character below them; the hero placement's height (`0.42·H`) is additionally capped so his silhouette top, and the greeting bubble just above it (allowance 72 px), stay ≥ 12 px below the sub-line's bottom (measure the copy block on layout). Where a centred placement leaves no room beside him for the "Play with me" button (§7.4), he steps left until he and the button are centred as a group (never closer than 16 px to the left edge), so it never sits over him. In chapters he may overlap the lower edge of the browser frame (images, not text). Narration bubbles sit in the gap between frame and character (§6.3).

About text (draft, facts only): "I'm a full-stack developer based in Kathmandu. At CloudProAI I built frontends, APIs and data pipelines for client products. Now I take on freelance projects, from first sketch to a site that's live." [call — owner may edit]

Links: LinkedIn `https://www.linkedin.com/in/aryanshrestha274/`, GitHub `https://github.com/aryan-shrestha` (from the owner's previous site).

**Placement geometry** (CSS px; `S` = px per model unit; model is described in §7.1):

| Placement | Desktop (> 900 px wide) | Phone/tablet (≤ 900 px) |
|---|---|---|
| `hero` / `outro` | `S = min(0.86·H / (BOX.y1 + 1.2), 0.42·W / 5.2)`; right edge at `W − max(16, 0.03W)`; model y = −1.2 sits on the bottom edge | `S = min(0.42·H / (BOX.y1 + 1.5), (W − 24) / 6.35)` (BOX.y1 = 3.15, §7.6; 6.35 = widest measured pose, §7.5.2); centred, or stepped aside for the "Play with me" button (above); model y = −1.5 on the bottom edge |
| `left` / `right` | `0.85 × hero S`, at the left/right margin | `0.62 × hero S`, at the left/right margin, **fully on screen** (sebg peeks off the edge on phones — deliberately not copied) [decided] |
| `badge` | 160 px circle, 24 px from bottom-left; head centred | 112 px circle, 16 px from bottom-left |

**Transition window:** for the boundary into section *k*, progress `p = clamp((scrollY + 0.95·H − top_k) / (0.75·H), 0, 1)`, eased with smootherstep; position, scale and badge-clip all interpolate on that one value.

### 6.2 Project chapters

Each chapter: full-bleed section in its tint with the grid; a **sticky stage** (100 svh) holding the title, a "View project →" button and a **browser-window frame** on the side opposite the character; the narration lines scroll over the stage on the character's side.

| Order | Project | Side | Tint / text | Highlight | Outfit | Host pill |
|---|---|---|---|---|---|---|
| 1 | Napa Valley Weddings (2025) | left | `#24402d` / paper | `#8a6a1f` | dark blazer + vermilion bow tie (over the hoodie collar) | napavalleyweddings.com |
| 2 | Bevlytics (2025) | right | `#f6c9d8` / ink | `#b0144f` | yellow hard hat ("pipeline builder"; wrench removed in v1.2) | bevlytics.ai |
| 3 | Data to Insights (2026) | left | `#151413` / paper | `#c2410c` | detective hat + magnifying glass | datatoinsights.ai |

Outfit swaps happen at the midpoint of the slide between chapters (sebg pattern). Outfit art: [builder], built from primitives like the rest of the character, recognisable at dither resolution.

### 6.3 Narration lines, gestures, screens

Exactly one line is active at a time. Desktop: a line is active while its bubble's top is between 6% and 42% of the viewport height (above the character's head). Phones: the bubble is `position: sticky` at 56 svh, between the browser frame and the character. Inactive lines fade out. Each activation triggers its gesture once. Highlighted phrases are **bold in the highlight colour**.

| Chapter | Line | Gesture | Browser frame shows |
|---|---|---|---|
| Napa | This is **Napa Valley Weddings**. I built the whole thing, front to back. | wave | `napa-valley-weddings` screenshot |
| Napa | **Next.js** on the front, **Python and FastAPI** behind it. | point (at the frame) | diagram: Browser → Next.js → FastAPI |
| Napa | Couples plan their wine-country wedding here. I make sure **"Book Now"** actually books. | thumbs | screenshot |
| Bevlytics | This is **Bevlytics**. I built the pipeline that feeds it. | wave | `bevlytics` marketing screenshot |
| Bevlytics | Raw distributor data runs through **ETL on AWS Lambda** into **Snowflake**. | think | diagram: distributor data → AWS Lambda (ETL) → Snowflake; CloudWatch alongside Lambda |
| Bevlytics | **CloudWatch** watches the logs, so nobody has to at 3am. | thumbs | same diagram, CloudWatch highlighted |
| Data to Insights | This is **Data to Insights**. I built features on the front and back end. | wave | marketing page (cropped, §9) |
| Data to Insights | **NestJS and Postgres** behind, **React and TanStack** in front. | point | Actions screen (cropped) |
| Data to Insights | **Zod** checks the data at every door. | think | Chat screen (cropped) |

Screen changes use a **dither dissolve** (~400 ms: the outgoing image breaks into ordered-dither dots and the next resolves from them) [call]. Diagrams are built in code (SVG/HTML), styled in the site's ink/paper/accent system with a dither texture, not images.

### 6.4 All work
Heading "All work", count "3 projects", grid (3 columns desktop, 1 column phone) of 3:2 covers. Covers are the project's hero image rendered **dithered and tinted** with the project's tint (real ordered dither, not a CSS approximation) [call]; caption: name (display face) and year. Each links to `/work/[slug]`.

### 6.5 Contact
Click-to-copy email (Clipboard API, with a visible fallback `mailto:` link). Copy feedback in a small toast and, if the character is present, his bubble: "Copied! Talk soon." [call]

### 6.6 Case-study pages `/work/[slug]`
Structure (all three): back link "← All work" · title · meta row (Year · Built at CloudProAI · My part · Live link ↗) · stack pills · hero image in a browser frame · **The problem** (2–3 sentences: what the product does and for whom) · **What I built** (first person, concrete; diagram where listed) · more images · "Next project →".

| | Napa Valley Weddings | Bevlytics | Data to Insights |
|---|---|---|---|
| Year | 2025 | 2025 | 2026 |
| Built at | CloudProAI | CloudProAI | CloudProAI |
| My part | The whole product, frontend and backend | ETL pipeline on AWS Lambda loading Snowflake; CloudWatch log monitoring | Frontend and backend features |
| Stack (list exactly these) | Next.js, Python, FastAPI | Python, AWS Lambda, Snowflake, CloudWatch | NestJS, React, PostgreSQL, Zod, TanStack |
| Live | https://www.napavalleyweddings.com/ | https://www.bevlytics.ai/ | https://www.datatoinsights.ai/ |
| Product (for "The problem") | Wedding planning for couples marrying in Napa Valley; packages, venues, vendors, booking | Beverage analytics: turns raw distributor and point-of-sale data into insights (public site: "a division of paradYmdata.com") | Connects to data sources, profiles datasets, automates data-quality checks, governance and lineage |
| Diagram | Browser → Next.js → FastAPI | data → Lambda → Snowflake, CloudWatch | none |
| Outcomes | none supplied — omit the section | none — omit | none — omit |

The character on case pages [call]: enters at placement `right` (desktop: the page reserves a right gutter of `0.85 × hero S × 3.5` px so he never sits over text; phones: no gutter) and says one comment (e.g. "The data had opinions." for Bevlytics; builder writes the three lines in the same voice, no factual claims). After 4 s, or on the first scroll, he shrinks into the **badge** placement (bottom-left) for the rest of the page, so he never covers text or swallows taps on links. The handle is only as big as the badge then. Same rule on `/dress-up`'s not-found variant header area: n/a (dress-up is his own stage, §7.6).

**Launch scope: short pages.** [decided] No further project details will be supplied before launch. "The problem" is written from the Product row above; "What I built" restates only the My part, Stack and Diagram rows in first person (2–4 sentences, no additional claims). Detail can be added later by editing the MDX.

**Field rules for the MDX frontmatter schema:** required — `title, slug, year, builtAt, myPart, stack[], liveUrl, tint, highlight, heroImage, problem, built`. Optional — `images[]` (Napa and Bevlytics have none beyond the hero; render the "more images" block only when present), `diagram`, `outcomes`.

---

## 7. The character

### 7.1 Model [decided — match prototype v10]
Built from Three.js primitives with a simple rig (body, head, two arms with shoulder + elbow joints). Look config (also the dress-up schema):

```ts
type Look = {
  hair: 'wavy-fringe' | …;          // default: thick wavy near-black, volume on top, fringe swept to his right
  colors: { skin: '#efc6a2'; hair: '#3a2f28'; hoodie: '#55555c'; stubble: '#b98d6a' };
  facialHair: 'moustache-stubble';  // thin moustache + chin/jaw stubble
  glasses: false;                   // not part of Aryan's default look [decided]; a dress-up option (§7.6)
  outfit: 'hoodie' | 'blazer-bowtie' | 'hardhat' | 'detective';
};
```
Face: smiling, crinkled arc eyes (default); open dot eyes for surprise; closed-smile mouth / open mouth. Eyes, brows, mouth and glasses sit on thin paper-coloured rims (≥ one dither cell at phone size) so they read on every skin swatch while the skin keeps its true tone. Hoodie with collar ring, hood at the back, two drawstrings with tips.

### 7.2 Rendering [decided]
- Full-window `<canvas>`, `position: fixed; inset: 0; pointer-events: none`, above content.
- **Orthographic camera in CSS pixels** (origin = window centre): no perspective distortion at edges; positions map 1:1 to screen.
- Two passes: scene → low-res render target (`W/PX × H/PX`, nearest filtering; `PX = 3` CSS px per dot, `2` below 600 px wide) → full-screen **ordered-dither** pass (4×4 Bayer) to 2 colours: `ink` dots on white `#ffffff`.
- Inverted-hull ink outlines (normal-offset 0.035 model units) on body parts.
- **Drawstrings** (and any accent-tagged part) dither in **vermilion + white** instead of ink + white. Tagging: accent parts write a flag into a second channel (e.g. the render target's alpha or an MRT ID buffer), **not** a marker colour, so any hoodie/outfit colour from dress-up works. [call]
- Circular clip uniform for the badge (closes in as he shrinks).

### 7.3 Always-on behaviour
| Behaviour | Spec |
|---|---|
| Idle | breathing bob, slow head sway, blink every 2–5 s |
| Look | head follows the cursor (yaw ±0.5 rad, pitch ±0.3); while sliding between placements, head turns toward travel direction |
| Drag | invisible handle element tracks head+torso on screen (`touch-action: none`), mouse and touch; while carried: arms flail **upward**, open-eyed, tilt with velocity; on release: spring back to the placement (k = 60, c = 11, ζ ≈ 0.71: at most one small overshoot, the approved prototype's feel) |
| Poke | tap/click without drag (< 6 px movement) → reaction + opens the action menu (§7.4) |
| Speech bubble | attached bubble in hero/outro; positioned above-left of head, clamped on screen |
| Mobile mode | when the window crosses 900 px: "Ooh, phone size." style quip [builder writes] |
| Returning visitor | `localStorage` flag → "Oh hi, you're back." variant in hero bubble (wrapped in try/catch; works without storage) |

### 7.4 Actions (full set) [decided: full set from day one]
Played from an **action menu**: a small speech-bubble list that opens on poke, and is reachable by keyboard via a visible "Play with me" button near the character [call]. Each action is a keyframed pose sequence 1.5–4 s, returns to idle.

wave · dance · panic · fly (lifts off, hovers, lands) · vanish (dither-dissolves out and back) · hiccup · peekaboo (hides behind hands) · selfie (arm out, flash) · dizzy (spins, wobbles) · sneeze · sulk (turns away) · **deploying** (types furiously, then celebrates — his own) 

Narration **gestures** (§6.3): wave, point, thumbs, think, cheer.

All speech lines are **written fresh** in Aryan's voice; none are copied from sebg. Approved examples from the prototypes: "Psst. You can grab me." · "Whoa, put me down!" · "Smooth landing. Mostly." · "Tests passed. Dance break." · "Who pushed to main on a Friday?"

### 7.5 Containment (no clipping) [decided — hard requirement]
1. **Silhouette clamp every frame:** after the frame's final pose is applied, compute the exact silhouette bounds (`Box3.setFromObject(char, precise=true)`); if any part crosses the left, right, or top edge (padding = outline + 2 dither cells), shift him inward and zero that axis of the spring velocity. Skipped only once the badge clip alone keeps him inside the window (the clip circle lies within the padded window on the left, right and top); until then the circle hides nothing and the clamp applies, also while he shrinks into or grows out of the badge. Between that point and the badge itself the shift fades out with the circle, so the hand-over never jumps.
2. **Sizing from measured poses:** widest measured silhouettes (model units), prototype: idle ±1.74, wave −3.04…+1.74, dance −2.78…+2.82, panic −2.82…+2.63, drag ±2.16. Measured on the build at 60 fps from idle with the real damping and elbow fold, transients included, the widest totals are drag 6.21, cheer 6.20, panic 6.17. Phones size to total width **6.35** (that maximum + 0.1, rounded up to 0.05); desktop sizes to ±2.6 and lets (1) nudge during wide moves.
3. **Natural arm raise:** while an arm swings through horizontal, the elbow folds (`1.6·sin|θ|`) so the hand never sweeps out wide; once the arm reaches its pose, the gesture's own elbow angle applies.
4. Every new action must be measured and stay within these bounds, or the bounds/sizing are updated (enforced by tests, §10).

### 7.6 Dress-up page `/dress-up` [call]
Large centred character (his own stage: placement `stage`, centred, `S` sized to fit the widest pose plus the tallest hat; on narrow stages he steps aside for the "Play with me" button as in §6.1) with controls. "Reset" restores Aryan's look.

**State model:** `look = { base, outfit }`.
- `base` (visitor-editable, persisted per viewer in `localStorage`, try/catch, page works without it): hair style ∈ {wavy-fringe (Aryan), short-crop, curly-top, buzz}; hair colour ∈ 5 swatches {`#3a2f28` default, `#1a1a1a`, `#6b4a2b`, `#b8863b`, `#9aa0a6`}; skin ∈ 5 swatches {`#efc6a2` default, `#f7dcc4`, `#d9a47c`, `#a8724f`, `#6e4630`}; hoodie colour ∈ 6 swatches {`#55555c` default, `#2f4a6b`, `#6b2f3a`, `#3f5a3a`, `#c9c4b8`, `#1f1f22`}; glasses on/off.
- `outfit` ∈ {hoodie, blazer-bowtie, hardhat, detective}: the visitor's pick applies everywhere **except inside project chapters**, where the chapter's outfit (§6.2) overlays the visitor's base (so a visitor's hair/skin/hoodie colour carries into chapters; the outfit swaps as designed).
- Engine API: `setLook(base)` changes base traits; `setOutfit(id)` sets the visitor's outfit. It takes no priority argument: the engine derives the chapter outfit from the section in view (`data-outfit`) and overlays it inside chapters, releasing it on leaving.

**Containment:** every hair × outfit combination is measured; `BOX.y1` (top bound, 3.05 in the prototype) becomes the maximum measured top (hats/curly-top raise it) and sizing uses that: **3.15** (hard hat 3.14, curly-top 3.12, Aryan's own look 2.98). The clip regression (§10) runs idle + 3 widest actions for every outfit and every hair style (not the full cross-product of colours: colours don't change bounds).

### 7.7 Loading and fallback
- The page renders and is readable without the character. The engine (Three.js + model) is a separate chunk, loaded after the page is interactive (`requestIdleCallback`, timeout 2 s).
- No WebGL → static dithered PNG of him at the hero/outro placements, no interactions.

### 7.8 Reduced motion
`prefers-reduced-motion: reduce` → no scroll choreography, no idle motion, no automatic gestures: a static dithered image in the hero and the badge (with WebGL: one canvas frame of the visitor's current look, redrawn only when it changes; without WebGL: `still.png`, §7.7); narration lines show as plain text blocks; actions available only when explicitly chosen from the menu, and play as a single still pose. [call]

---

## 8. Accessibility
- Canvas and handle are `aria-hidden`; all narration, bubbles and headings are real DOM text.
- Keyboard: every link/button reachable; "Play with me" opens the action menu; Escape closes it.
- Colour contrast per §4.1; focus rings visible on all tint backgrounds.

---

## 9. Assets and privacy

Source images: `../portfolio/public/images/` (owner's previous site). Publish only these, optimised via `next/image` (AVIF/WebP):

| Use | File | Treatment |
|---|---|---|
| Napa hero/screen | `napa-valley-weddings.png` | as-is |
| Bevlytics screen | `bevlytics.png` | as-is (public marketing page) |
| DTI marketing screen | `data-to-insights.png` | **crop to top ~1480 px (original pixels)** so the embedded app's user block (a third person's name and email) is excluded |
| DTI Actions | `data-to-insights-3.png` | crop to exclude sidebar header and the bottom-left account block (owner's name + work email); reference crop: `.superpowers/…/content/dti-desktop.jpg` |
| DTI Chat | `data-to-insights-2.png` | same crop as above |
| **Excluded** | `bevlytics-2.png`, `bevlytics-3.png` | show a real client's sales data and `admin@cloudproai.com` — **do not publish** |

Rules: strip EXIF from everything; `me.jpg` (owner photo) is **not** published. Missing `napa-valley-weddings-2/3.png` referenced by the old site do not exist — not needed.

---

## 10. Engineering

- **Stack:** Next.js (latest stable, App Router, static generation for all routes), TypeScript (strict), Tailwind CSS v4, Three.js. Case studies as MDX with frontmatter validated by a Zod schema (missing/invalid field fails the build). Hosting: Vercel. [call]
- **Engine API** (React ↔ engine): `mount(canvas, handleEl)`, `setPlacements(sections)`, `play(action)`, `gesture(name)`, `say(text, ms?)`, `setOutfit(id)`, `setLook(look)`, `destroy()`. React components register sections via `data-place`, `data-outfit`, `data-gesture` attributes.
- **Performance budgets:** Lighthouse mobile Performance ≥ 90; LCP ≤ 2.5 s on simulated mid-tier mobile; initial JS (excluding the lazy engine chunk): app-owned ≤ 30 KB gz **and** total ≤ 160 KB gz (the Next 16 + React 19 framework floor alone is ~129–134 KB gz); engine chunk ≤ 220 KB gz; 60 fps idle on a mid-range laptop (render target is ≤ ~500×300 at PX 3).
- **Tests:**
  - Vitest: placement maths (§6.1 formulas, transition window), containment function, narration activation band, Zod content schema.
  - Playwright (Chromium; WebGL via SwiftShader): (a) **clip regression** — 7 viewports (1920×1080, 1440×900, 1280×600, 1024×768, 768×1024, 390×844, 360×640) × {idle, every action, drag to each corner and off-screen, wide pose pinned to each edge}: no character pixels on the left/right/top edge; (b) **scroll tour** — 5 viewports × 31 scroll positions: no clipping, exactly one active narration line, correct placement per section; (c) no console errors; (d) reduced-motion and no-WebGL fallbacks render.
- **Repo hygiene:** `.superpowers/` in `.gitignore`.

---

## 11. Left to the builder
- Body + mono font pairing (§4.2).
- Outfit and action keyframes/modelling within §7.5 bounds.
- Quip copy for mobile-mode, case-page comments, action reactions — Aryan's voice (short, first person, a bit cheeky), no factual claims.
- Diagram visual design within the system.
- Exact dither-dissolve implementation.

## 12. Open items (not blocking the plan)
- **Domain** for launch: not yet chosen.


## 13. Repository conventions
ShipMint's `AGY-STANDARDS.md` does **not** apply: this is a personal project. [decided] Plain git repo; `main` as the default branch; work on feature branches; no handover documents required.

---

## Changelog — v1.1 (2026-11-25)

Build rulings that changed spec text (ledger: `.superpowers/sdd/2026-11-25-portfolio/progress.md`). The sentences above are updated in place to match.

| Ruling | Change | Section | Reason |
|---|---|---|---|
| R13 | Phone sizing width `WIDEST_TOTAL` 5.75 → **6.35** | §6.1, §7.5.2 | Measured transients (drag 6.21, cheer 6.20, panic 6.17) exceeded 5.75 and touched phone edges for 1–2 frames. |
| (T11) | `BOX.y1` 3.05 → **3.15** | §6.1, §7.6 | The hard hat (3.14) is the tallest measured top over every hair × outfit × pose. |
| R16 | Initial JS budget 120 KB gz → app-owned ≤ 30 KB gz **and** total ≤ 160 KB gz (engine ≤ 220 KB gz unchanged) | §10 | 120 KB is below the Next 16 + React 19 framework floor (~129–134 KB gz); the Lighthouse ≥ 90 and LCP ≤ 2.5 s gates stay and are met. |
| N9 (T11) | `setOutfit(id)` has no priority argument | §7.6 | Chapters drive the chapter outfit internally from `data-outfit`; an external "chapter" call was overwritten every frame. |
| R14 | Paper-coloured rims behind eyes, brows, mouth and glasses | §7.1 | Facial features vanished on the darkest skin swatch; rims keep them legible without lightening the skin. |
| R17 | Reduced motion with WebGL: one canvas frame of the visitor's look; `still.png` only without WebGL | §7.8 | The visitor's pick applies everywhere (§7.6); a single frame is still "static". |
| R12 | Drag spring k = 60, c = 11 (ζ ≈ 0.71), not critically damped | §7.3 | It is the owner-approved prototype feel; at most one small overshoot. |
| (T11) | Glasses are a dress-up option, not part of Aryan's default look | §7.1 | "Tried and removed" read as "never available"; the default look stays without them. |
| R18 | Phones: he steps aside so the "Play with me" button stands beside him | §6.1, §7.6 | A centred phone placement left no room, and the button sat over his sleeve. Made at the finish; for owner review. |
| R18 | Phones: the hero cap also keeps the greeting bubble clear of the copy | §6.1 | At 320 × 568 the bubble covered the sub-line. Binds only below ~360 px wide. Made at the finish; for owner review. |
| R20 | Containment "skipped while he is the badge" → skipped only once the badge clip alone keeps him inside the window; the shift fades out between that point and the badge | §7.5.1 | The clamp was off from the first tenth of the slide into or out of the badge while the clip circle (≈ 900 px radius halfway) still hid nothing: he crossed the left edge by up to 54 px during the automatic cheer and wave, menu actions and drags. |


## Changelog — v1.2 (2026-11-25, owner requests after the build)

The sections above keep their v1.1 text; where they disagree with this table, this table wins.

| Change | Section | Reason |
|---|---|---|
| Employer "CloudProAI" → **Data to Insights AI** everywhere (About copy, `builtAt`, "Built at …" on the case studies) | §1, §6, §6.6 | Owner: the site uses the employer name on their LinkedIn (Software Engineer, Data to Insights AI, Jun 2025 – Sep 2026). |
| New section **Experience** (`#experience`, `data-place="badge"`, `data-gesture="thumbs"`) between All work and Contact: 5 roles newest first (dates, title · company, skills, location · mode; the Data to Insights AI role links the three case studies), then **Licenses & certifications** (4 cards: issuer · date, name, credential ID, "Show credential ↗" in a new tab). Data in `content/experience.ts`, copied from LinkedIn on 2026-11-25. | §5, §6 | Owner request. He stays in the badge, so there is no glide between All work and Experience. |
| Chapter speech bubbles get a tail toward the character (leaning inward on desktop, outward on phones); reduced-motion stacked bubbles are `position: relative` and 40 px apart | §6.3, §7.8 | Owner request. |
| Hand props (wrench, magnifier) are gripped **across the fist**: handle behind the fingers, head out of the thumb side. They used to lie along the forearm with the head at the elbow. Outfits holding a prop size phones to `WIDEST_HELD` = 6.65 (measured 6.51 + 0.1, rounded up) instead of `WIDEST_TOTAL` = 6.35. Only a visitor who picks the hard hat or deerstalker on dress-up gets the ~4.5% smaller phone hero, contact and stage; the default look is unchanged. | §6.2, §7.5.2, §7.6 | Owner: the wrench did not sit in the hand. Any visible head out of the fist widens the arms-up poses (cheer, panic, drag) by ~0.3, so the budget is per outfit rather than raised for everyone. |
| **Wrench removed** from the Bevlytics outfit: the hard hat holds nothing. Only the deerstalker's magnifier is a hand prop, so only that look sizes phones to `WIDEST_HELD`; the hard hat is back on `WIDEST_TOTAL`. | §6.2, §7.6 | Owner request. |
| Experience rows no longer show job titles: each leads with the company (dates, company, skills, location · mode). Titles stay in `content/experience.ts`. Section background is plain paper, no grid. | §6 | Owner requests (grid hurt readability). |
| Maitri Services skills, from the owner (LinkedIn lists none): Python, FastAPI, Browser Automation, TypeScript, React, GCP. | §6 | Owner request. |
| Data to Insights AI skills, from the owner (replacing LinkedIn's): Python, FastAPI, TypeScript, Next.js, NestJS, PostgreSQL, AWS. The "Built here" line (links to the three case studies) is removed; rows have no links. | §6 | Owner request. |
| The "N roles since YYYY" counter beside the Experience heading is removed. | §6 | Owner request. |
| About text: "I'm a full-stack developer in Kathmandu, now a software engineer at Maitri Services. Before that, at Data to Insights AI, I built frontends, APIs and data pipelines for client products. I take on freelance projects too, from first sketch to a site that's live." | §6.1 | Owner: the old text read as if he still worked at Data to Insights AI. |
| **Smooth scrolling** (Lenis 1.3.27, `components/SmoothScroll.tsx`), site-wide, loaded after idle: wheel and keyboard scrolling glide (lerp 0.1); touch stays native; off entirely under reduced motion (follows the setting live); anchor links stay instant jumps so the character plays only the destination gesture (N11); the dress-up controls panel opts out (`data-lenis-prevent`). Initial-JS budget still met. | §6.1, §7.8, §10 | Owner request. |
| Data to Insights, from the owner: stack React, Zod, TanStack, shadcn/ui, NestJS, TypeORM, PostgreSQL, AWS SDK. "What I built" covers front-end features; NestJS/TypeORM back end with the AWS SDKs; connectors for Snowflake and Google Drive; the tenant isolation layer (PostgreSQL RLS + tenant unit of work). Chapter lines 2–3 rewritten to match (line 3 was Zod). | §6.3, §6.6 | Owner request. |
| **All work removed from the home page for now** (component and covers kept, not mounted). Experience is now the first badge section (his badge entry gesture is its thumbs-up; the cheer went with All work). The case-study back link "← All work" (`/#work`) becomes "← Home" (`/`). | §5, §6.4, §6.6 | Owner request. |
| Data to Insights gets an architecture diagram like Bevlytics: React (front end) → NestJS (TypeORM) → PostgreSQL (RLS), with Snowflake and Google Drive connectors feeding NestJS; a `dti-tenant` variant highlights the tenant path (NestJS "tenant UoW" → PostgreSQL RLS) in vermilion. Chapter lines 2–3 show the two diagrams instead of the Actions/Chat screenshots (still on the case page); the case study shows `dti` under What I built. AWS is not drawn (which services the SDKs used is not stated). | §6.3, §6.6 | Owner request. |
| **Colour dither, everywhere** (owner chose "everywhere"; replaces the 1-bit ink/white dither of §7.1–7.2). Dots take each surface's hue (darkened to 0.5), gaps a light tint of it (≤ 0.5 from white); hue scales with saturation above a 0.1 floor, so neutrals (outline ink, the greys, white) stay ink on white and his default look keeps grey dots on the hoodie, with warm brown hair and a peach face. Vermilion drawstrings unchanged. Formula in `engine/render/tone.ts` (`COLOUR`, `ditherColours`, shared GLSL). Feature rims (R14) are tagged in the render target (alpha 0.8) and drawn as the skin's own gap tint, so there are no white halos. still.png (32-colour palette), og.png and the icons re-rendered. | §7.1, §7.2, §7.6, §7.7 | Owner: colour picks on dress-up were invisible (the dither kept only luminance). |
| **Idle routines** (`engine/idle.ts`): after 20 s with no input (scroll, wheel, keys, pointer, touch) a random gentle emote (think, thumbs, hiccup, sneeze, peekaboo, wave) every 15–30 s, never the same twice running; at 60 s he yawns and naps ("Zzz…", a 4 s breath-and-nod loop) until any input wakes him (startled hop, "I'm up! I'm up."); back on the tab after ≥ 15 s away he waves "Oh, you're back!". Never while dragged, mid-glide, with the menu open, or under reduced motion / no WebGL. New poses yawn 2.8 s, sleep 4 s, wake 1.4 s, inside the measured width/top budgets. e2e builds start with idle off (deterministic long samples); tests/e2e/idle.spec.ts turns it on at 1/50 speed. | §7.3, §7.4, §7.8 | Owner request. |
| **"Dress me up" pill** beside "Play with me" (components/character/ActionMenu): a client link to /dress-up wherever the pill shows; not as the badge, not on the dress-up stage, not without WebGL (the footer link stays). It takes the first layout that fits beside him and covers no page text (`[data-copy]` and footer text on screen, re-checked on scroll): a row on the far side of "Play with me", stacked above it (portrait phones), or a round hanger-icon button in the row (still named "Dress me up"; e.g. the hero at 1024×768). Where "Play with me" itself would cover text (the contact footer at 1024×768), both pills rise above it. The menu opens above both. | §7.4, §8 | Owner request: dress-up easier to reach. |
