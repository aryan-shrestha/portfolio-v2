/**
 * Shift (CSS px, y up) that brings a silhouette inside the window: left, right and top edges only
 * (bottom crop is intended). A silhouette wider than the window is centred.
 */
export function containShift(
  bounds: { minX: number; maxX: number; maxY: number },
  W: number,
  H: number,
  pad: number,
): { dx: number; dy: number } {
  const L = -W / 2 + pad
  const R = W / 2 - pad
  const T = H / 2 - pad
  let dx = 0
  let dy = 0
  if (bounds.maxX - bounds.minX > R - L) dx = (L + R) / 2 - (bounds.minX + bounds.maxX) / 2
  else if (bounds.minX < L) dx = L - bounds.minX
  else if (bounds.maxX > R) dx = R - bounds.maxX
  if (bounds.maxY > T) dy = T - bounds.maxY
  return { dx, dy }
}
