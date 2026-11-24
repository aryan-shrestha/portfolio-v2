import type { Placement, PlacementKind } from './types'

export type { Placement, PlacementKind }

/** Model-unit bounds around the character origin. y1 is replaced by the measured maximum (Task 11). */
export const BOX = { x0: -2.6, x1: 2.6, y1: 3.05 }
/** Widest measured pose, total width in model units (spec §7.5). */
export const WIDEST_TOTAL = 5.75

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function computePlacements(
  W: number,
  H: number,
  opts: { copyBottom?: number } = {},
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
  const Sst = Math.min((W - 48) / WIDEST_TOTAL, (H - 48) / height)

  return {
    hero,
    outro: { ...hero },
    left: { x: -W / 2 + m + 1.75 * Ss, y: bottom(Ss), S: Ss, talk: 0, badge: 0 },
    right: { x: W / 2 - m - 1.75 * Ss, y: bottom(Ss), S: Ss, talk: 0, badge: 0 },
    badge: { x: cx, y: cy - 1.78 * Sb, S: Sb, talk: 0, badge: 1, cx, cy, d },
    stage: { x: 0, y: bottom(Sst), S: Sst, talk: 0, badge: 0 },
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
    }
    if (p > 0.5) current = k
  }
  return { st, current }
}
