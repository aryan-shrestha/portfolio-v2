import { describe, expect, test } from 'vitest'
import { bayerMask } from '@/lib/dissolve'

// Standard 4×4 Bayer matrix, written out independently of the implementation.
const RANK = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

function decode(uri: string): string {
  const prefix = 'data:image/svg+xml,'
  expect(uri.startsWith(prefix)).toBe(true)
  return decodeURIComponent(uri.slice(prefix.length))
}

/** Revealed cells as "col,row" strings, from the rects in the SVG. */
function cells(uri: string, cell: number): string[] {
  const svg = decode(uri)
  const rects = [...svg.matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/g)]
  for (const r of rects) {
    expect(Number(r[3])).toBe(cell)
    expect(Number(r[4])).toBe(cell)
  }
  return rects.map((r) => `${Number(r[1]) / cell},${Number(r[2]) / cell}`).sort()
}

function expected(level: number): string[] {
  const out: string[] = []
  RANK.forEach((row, y) => row.forEach((rank, x) => rank < level && out.push(`${x},${y}`)))
  return out.sort()
}

describe('bayerMask', () => {
  test('is a 4×4-cell SVG tile', () => {
    const svg = decode(bayerMask(7, 3))
    expect(svg).toMatch(/^<svg[^>]*xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)
    expect(svg).toMatch(/width="12" height="12"/)
  })

  test('level 0 reveals no cells', () => {
    expect(cells(bayerMask(0, 3), 3)).toEqual([])
  })

  test('level 16 reveals all 16 cells', () => {
    expect(cells(bayerMask(16, 3), 3)).toHaveLength(16)
  })

  test('level 5 reveals exactly the cells ranked 0–4', () => {
    const got = cells(bayerMask(5, 3), 3)
    expect(got).toHaveLength(5)
    expect(got).toEqual(expected(5))
  })

  test('every level reveals the cells ranked below it', () => {
    for (let level = 0; level <= 16; level++) {
      expect(cells(bayerMask(level, 4), 4)).toEqual(expected(level))
    }
  })

  test('levels outside 0–16 are clamped', () => {
    expect(cells(bayerMask(-3, 3), 3)).toEqual([])
    expect(cells(bayerMask(40, 3), 3)).toHaveLength(16)
  })
})
