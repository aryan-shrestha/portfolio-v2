/** 4×4 ordered-dither (Bayer) ranks, row by row. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const

export const DISSOLVE_MS = 400
export const DISSOLVE_STEPS = 16

/**
 * A 4×4-cell SVG tile, as a data URI, that reveals (opaque) every cell whose Bayer rank is
 * below `level` (0 = nothing, 16 = everything). Used as a repeating `mask-image` with
 * `mask-size: 4·cell` so the incoming screen resolves from ordered-dither dots.
 */
export function bayerMask(level: number, cell: number): string {
  const n = Math.max(0, Math.min(DISSOLVE_STEPS, Math.round(level)))
  const size = cell * 4
  let rects = ''
  BAYER4.forEach((rank, i) => {
    if (rank < n) {
      rects += `<rect x="${(i % 4) * cell}" y="${Math.floor(i / 4) * cell}" width="${cell}" height="${cell}"/>`
    }
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${rects}</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}
