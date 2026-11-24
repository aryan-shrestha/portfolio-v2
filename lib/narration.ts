/** Desktop: a line is active while its top sits in [0.06H, 0.42H) — above the character's head. */
export const DESKTOP_BAND = [0.06, 0.42] as const
/** Phones: the bubble is sticky at 0.56H; the line must still reach past it by this much. */
export const MOBILE_SLOT = 0.56
export const MOBILE_REACH = 110
export const MOBILE_TOP = 0.6

/**
 * Index of the narration line that should be active (−1 if none), spec §6.3.
 * `tops`/`bottoms` are the lines' viewport rects in page order; `H` is the viewport height.
 * The last qualifying line wins, so exactly one is ever active.
 */
export function activeLineIndex(tops: number[], bottoms: number[], H: number, mobile: boolean): number {
  let active = -1
  for (let i = 0; i < tops.length; i++) {
    const ok = mobile
      ? tops[i] < H * MOBILE_TOP && bottoms[i] > H * MOBILE_SLOT + MOBILE_REACH
      : tops[i] >= H * DESKTOP_BAND[0] && tops[i] < H * DESKTOP_BAND[1]
    if (ok) active = i
  }
  return active
}

/** Dispatched on a chapter's <section> when one of its lines activates: detail { line }. */
export const SCREEN_EVENT = 'narration:screen'
