import { describe, expect, it } from 'vitest'
import { containShift } from '@/engine/contain'

describe('containShift', () => {
  it('pushes a left overhang inward by the exact amount', () => {
    expect(containShift({ minX: -730, maxX: -300, maxY: 0 }, 1440, 900, 8)).toEqual({ dx: 18, dy: 0 })
  })
  it('pushes a right overhang inward', () => {
    expect(containShift({ minX: 300, maxX: 730, maxY: 0 }, 1440, 900, 8)).toEqual({ dx: -18, dy: 0 })
  })
  it('does nothing when inside', () => {
    expect(containShift({ minX: -100, maxX: 100, maxY: 100 }, 1440, 900, 8)).toEqual({ dx: 0, dy: 0 })
  })
  it('centres a silhouette wider than the viewport', () => {
    expect(containShift({ minX: -800, maxX: 900, maxY: 0 }, 1440, 900, 8)).toEqual({ dx: -50, dy: 0 })
  })
  it('pulls a top overhang down (negative dy, y up)', () => {
    expect(containShift({ minX: -10, maxX: 10, maxY: 460 }, 1440, 900, 8)).toEqual({ dx: 0, dy: -18 })
  })
})
