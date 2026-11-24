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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function computePlacements(
  W: number,
  H: number,
  opts: { copyBottom?: number; stage?: StageRect } = {},
): Record<PlacementKind, Placement> {
  const mobile = W <= 900
  const m = Math.max(16, W * 0.03)
  const cut = mobile ? -1.5 : -1.2 // model y that sits on the bottom edge
  const height = BOX.y1 - cut

  let Sh = mobile
    ? Math.min((H * 0.42) / height, (W - 24) / WIDEST_TOTAL)
    : Math.min((H * 0.86) / height, (W * 0.42) / (BOX.x1 - BOX.x0))
  const Ss = Sh * (mobile ? 0.62 : 0.85)
  // Phones: silhouette top (H - height*S from the top edge) stays 12px below the copy block.
  if (mobile && opts.copyBottom !== undefined) {
    Sh = Math.min(Sh, Math.max(0, (H - opts.copyBottom - 12) / height))
  }

  const bottom = (S: number) => -H / 2 - cut * S
  const hero: Placement = { x: mobile ? 0 : W / 2 - m - BOX.x1 * Sh, y: bottom(Sh), S: Sh, talk: 1, badge: 0 }

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

  return {
    hero,
    outro: { ...hero },
    left: { x: -W / 2 + m + 1.75 * Ss, y: bottom(Ss), S: Ss, talk: 0, badge: 0 },
    right: { x: W / 2 - m - 1.75 * Ss, y: bottom(Ss), S: Ss, talk: 0, badge: 0 },
    badge: { x: cx, y: cy - 1.78 * Sb, S: Sb, talk: 0, badge: 1, cx, cy, d },
    stage: { x: (r.left + r.right) / 2 - W / 2, y: floor - STAGE_CUT * Sst, S: Sst, talk: 0, badge: 0, floor },
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
