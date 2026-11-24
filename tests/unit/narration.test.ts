import { describe, expect, test } from 'vitest'
import { activeLineIndex } from '@/lib/narration'

describe('activeLineIndex — desktop (band [0.06H, 0.42H))', () => {
  const H = 900 // band [54, 378)
  const none: number[] = []

  test('first line inside the band is active', () => {
    expect(activeLineIndex([60, 500, 900], none, H, false)).toBe(0)
  })

  test('the line in the band wins over lines above it', () => {
    expect(activeLineIndex([-300, 100, 500], none, H, false)).toBe(1)
  })

  test('no line in the band gives -1', () => {
    expect(activeLineIndex([-600, -300, 20], none, H, false)).toBe(-1)
  })

  test('band edges: top inclusive, bottom exclusive', () => {
    expect(activeLineIndex([54], none, H, false)).toBe(0)
    expect(activeLineIndex([378], none, H, false)).toBe(-1)
  })

  test('when two lines are in the band the last one wins', () => {
    expect(activeLineIndex([60, 200], none, H, false)).toBe(1)
  })
})

describe('activeLineIndex — mobile (top < 0.6H and bottom > 0.56H + 110)', () => {
  const H = 844 // top < 506.4, bottom > 582.64

  test('a line straddling the sticky slot is active', () => {
    expect(activeLineIndex([300, 700], [650, 1000], H, true)).toBe(0)
  })

  test('a line that has scrolled past the slot is not active', () => {
    expect(activeLineIndex([100], [500], H, true)).toBe(-1)
  })

  test('the later qualifying line wins', () => {
    expect(activeLineIndex([-200, 400], [700, 900], H, true)).toBe(1)
  })
})
