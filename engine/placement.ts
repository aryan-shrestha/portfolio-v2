import type { Placement, PlacementKind } from './types'

export type { Placement, PlacementKind }

/**
 * Model-unit bounds around the character origin. y1 is the measured top (spec §7.6): the highest point
 * of every hair style × outfit over idle, wave, dance, panic and drag, simulated like WIDEST_TOTAL
 * (hats 3.14, curly-top 3.12, Aryan's own look 2.98), rounded up to 0.05. tests/unit/bounds.test.ts
 * re-measures it and fails if a style, outfit or pose rises above it.
 */
export const BOX = { x0: -2.6, x1: 2.6, y1: 3.15 }
/** Dress-up stage: the model y that sits on the stage floor, low enough to show his hands and what they hold. */
export const STAGE_CUT = -2.4
/** Stage margin, CSS px: each side of the widest pose, and above the tallest hat. */
export const STAGE_PAD = 16
/** The dress-up stage area in CSS px from the window's top-left (spec §7.6: he is centred on it). */
export type StageRect = { left: number; top: number; right: number; bottom: number }
/**
 * Widest total silhouette of any pose, model units (spec §7.5.2, updated per §7.5.4 / ruling R13): the
 * maximum over every action, gesture, idle and drag, simulated at 60 fps from idle with the runtime's
 * damping and elbow fold (drag 6.21, cheer 6.20, panic 6.17), + 0.1, rounded up to 0.05. Phones size
 * to it. tests/unit/poses.test.ts re-measures every pose and fails if one gets wider.
 */
export const WIDEST_TOTAL = 6.35
/** Half the idle silhouette width, model units (spec §7.5.2): where his sides are at rest, facing out. */
export const REST_HALF = 1.74
/**
 * How far one side reaches at rest when he turns his head toward it (measured 1.97 with the arm's idle
 * swing), model units. What the "Play with me" pill keeps clear of (PlaceInfo.left/right).
 */
export const IDLE_REACH = 2
/**
 * The "Play with me" pill beside him (components/character/ActionMenu): its width in CSS px (121 with
 * the 15 px label, + slack for the fallback font) and its gap to him and to the area's edge (16 phones,
 * 24 desktop). Where a centred placement leaves no room for it, he steps aside (see `aside`).
 */
export const PILL_W = 124
export const pillGap = (W: number) => (W <= 900 ? 16 : 24)
/**
 * Phones: the greeting bubble's height (two lines, 65 px) + slack. It sits just above his silhouette
 * top, so the hero cap keeps it, too, clear of the copy (spec §6.1 "he never covers reading text").
 */
export const BUBBLE_H = 72

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * How far (px, ≥ 0) to move him left from centre `c` so the pill fits on his right inside the area
 * [a0, a1]: none when it already fits on either side of him; else he and the pill are centred as a
 * group, but his left side (at rest) never comes closer than the gap to the area's edge.
 */
export function aside(c: number, S: number, a0: number, a1: number, W: number, pill = PILL_W): number {
  const g = pillGap(W)
  if (a1 - (c + IDLE_REACH * S) - g - pill >= g) return 0
  // the far side only needs its rest width clear of the edge: containment nudges a turned head inward
  return clamp((g + pill) / 2, 0, Math.max(0, c - REST_HALF * S - g - a0))
}

export function computePlacements(
  W: number,
  H: number,
  opts: { copyBottom?: number; stage?: StageRect; pill?: boolean } = {},
): Record<PlacementKind, Placement> {
  const mobile = W <= 900
  const m = Math.max(16, W * 0.03)
  const cut = mobile ? -1.5 : -1.2 // model y that sits on the bottom edge
  const height = BOX.y1 - cut

  let Sh = mobile
    ? Math.min((H * 0.42) / height, (W - 24) / WIDEST_TOTAL)
    : Math.min((H * 0.86) / height, (W * 0.42) / (BOX.x1 - BOX.x0))
  const Ss = Sh * (mobile ? 0.62 : 0.85)
  // Phones: silhouette top (H - height*S from the top edge), and the greeting bubble just above it,
  // stay 12px below the copy block.
  if (mobile && opts.copyBottom !== undefined) {
    Sh = Math.min(Sh, Math.max(0, (H - opts.copyBottom - 12 - BUBBLE_H) / height))
  }

  const bottom = (S: number) => -H / 2 - cut * S
  // Phones: centred, or stepped aside so the "Play with me" pill (when there is one) fits beside him.
  const heroX = mobile ? 0 - (opts.pill ? aside(W / 2, Sh, 0, W, W) : 0) : W / 2 - m - BOX.x1 * Sh
  const hero: Placement = { x: heroX, y: bottom(Sh), S: Sh, talk: 1, badge: 0 }

  const d = mobile ? 112 : 160
  const edge = mobile ? 16 : 24
  const cx = -W / 2 + edge + d / 2
  const cy = -H / 2 + edge + d / 2
  const Sb = d / 3.1
  // Stage: centred on its area (the whole window by default), fitting the widest pose and the tallest
  // hat; his floor is the area's bottom edge and nothing of him draws below it.
  const r = opts.stage ?? { left: 0, top: 0, right: W, bottom: H }
  const Sst = Math.max(
    0,
    Math.min((r.right - r.left - 2 * STAGE_PAD) / WIDEST_TOTAL, (r.bottom - r.top - STAGE_PAD) / (BOX.y1 - STAGE_CUT)),
  )
  const floor = H / 2 - r.bottom
  const stageC = (r.left + r.right) / 2
  const stageX = stageC - W / 2 - (opts.pill ? aside(stageC, Sst, r.left, r.right, W) : 0)

  return {
    hero,
    outro: { ...hero },
    left: { x: -W / 2 + m + 1.75 * Ss, y: bottom(Ss), S: Ss, talk: 0, badge: 0 },
    right: { x: W / 2 - m - 1.75 * Ss, y: bottom(Ss), S: Ss, talk: 0, badge: 0 },
    badge: { x: cx, y: cy - 1.78 * Sb, S: Sb, talk: 0, badge: 1, cx, cy, d },
    stage: { x: stageX, y: floor - STAGE_CUT * Sst, S: Sst, talk: 0, badge: 0, floor },
  }
}

/** Slow-fast-slow easing. */
export const smootherstep = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

export function transitionProgress(scrollY: number, H: number, sectionTop: number): number {
  return clamp((scrollY + 0.95 * H - sectionTop) / (0.75 * H), 0, 1)
}

export type PlacementState = Omit<Placement, 'talk' | 'badge'> & { talk: number; b: number }

// exact at t = 0 and t = 1, so a jump past a boundary lands on the destination value
const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t

export function placementAt(
  scrollY: number,
  H: number,
  sections: { top: number; kind: PlacementKind }[],
  P: Record<PlacementKind, Placement>,
): { st: PlacementState; current: number } {
  const first = P[sections[0].kind]
  let st: PlacementState = { ...first, b: first.badge }
  let current = 0
  for (let k = 1; k < sections.length; k++) {
    const p = transitionProgress(scrollY, H, sections[k].top)
    if (p <= 0) break
    const nx = P[sections[k].kind]
    const e = smootherstep(p)
    st = {
      x: lerp(st.x, nx.x, e),
      y: lerp(st.y, nx.y, e),
      S: lerp(st.S, nx.S, e),
      talk: lerp(st.talk, nx.talk, e),
      b: lerp(st.b, nx.badge, e),
      cx: nx.cx ?? st.cx,
      cy: nx.cy ?? st.cy,
      d: nx.d ?? st.d,
      floor: lerp(st.floor ?? -H / 2, nx.floor ?? -H / 2, e),
    }
    if (p > 0.5) current = k
  }
  return { st, current }
}
