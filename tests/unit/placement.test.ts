import { describe, expect, it } from 'vitest'
import {
  BOX,
  WIDEST_TOTAL,
  computePlacements,
  placementAt,
  smootherstep,
  transitionProgress,
  type PlacementKind,
} from '@/engine/placement'

describe('computePlacements desktop 1440x900', () => {
  const P = computePlacements(1440, 900)
  it('hero S = min(0.86H/4.25, 0.42W/5.2)', () => {
    expect(P.hero.S).toBeCloseTo(116.31, 2)
  })
  it('hero right edge sits at W/2 - max(16, 0.03W)', () => {
    expect(P.hero.x + BOX.x1 * P.hero.S).toBeCloseTo(720 - 43.2, 6)
  })
  it('hero model y=-1.2 sits on the bottom edge', () => {
    expect(P.hero.y + -1.2 * P.hero.S).toBeCloseTo(-450, 6)
  })
  it('outro equals hero', () => {
    expect(P.outro).toEqual(P.hero)
  })
  it('left/right are 0.85 x hero S, mirrored at the margin', () => {
    expect(P.left.S).toBeCloseTo(0.85 * P.hero.S, 9)
    expect(P.left.x).toBeCloseTo(-720 + 43.2 + 1.75 * P.left.S, 6)
    expect(P.right.x).toBeCloseTo(720 - 43.2 - 1.75 * P.right.S, 6)
  })
  it('badge: 160px circle 24px from bottom-left, head centred', () => {
    expect(P.badge.d).toBe(160)
    expect(P.badge.cx).toBe(-720 + 24 + 80)
    expect(P.badge.cy).toBe(-450 + 24 + 80)
    expect(P.badge.badge).toBe(1)
    expect(P.badge.S).toBeCloseTo(160 / 3.1, 9)
    expect(P.badge.x).toBe(P.badge.cx)
    expect(P.badge.y).toBeCloseTo(P.badge.cy! - 1.78 * P.badge.S, 9)
  })
  it('stage is centred and fits the widest pose and the height', () => {
    expect(P.stage.x).toBe(0)
    expect(P.stage.S).toBeCloseTo(Math.min((1440 - 48) / WIDEST_TOTAL, (900 - 48) / 4.25), 9)
  })
})

describe('computePlacements phone 390x844', () => {
  const P = computePlacements(390, 844)
  it('hero S = min(0.42H/4.55, (W-24)/5.75), centred', () => {
    expect(P.hero.S).toBeCloseTo(63.65, 2)
    expect(P.hero.x).toBe(0)
    expect(P.hero.y + -1.5 * P.hero.S).toBeCloseTo(-422, 6)
  })
  it('left is 0.62 x hero S and fully on screen', () => {
    expect(P.left.S).toBeCloseTo(0.62 * P.hero.S, 9)
    expect(P.left.x - 1.75 * P.left.S).toBeGreaterThanOrEqual(-195 + 16 - 1e-9)
  })
  it('badge is 112px, 16px from bottom-left', () => {
    expect(P.badge.d).toBe(112)
    expect(P.badge.cx).toBe(-195 + 16 + 56)
    expect(P.badge.cy).toBe(-422 + 16 + 56)
  })
  it('copyBottom caps hero so the silhouette top clears the copy by 12px', () => {
    const Q = computePlacements(390, 844, { copyBottom: 600 })
    const top = 844 / 2 - (Q.hero.y + 3.05 * Q.hero.S)
    expect(top).toBeGreaterThanOrEqual(612 - 1e-9)
    expect(Q.hero.S).toBeCloseTo((844 - 612) / 4.55, 9)
  })
  it('copyBottom does not change a hero that already clears the copy', () => {
    expect(computePlacements(390, 844, { copyBottom: 100 }).hero.S).toBeCloseTo(63.65, 2)
  })
})

describe('transition window', () => {
  it('transitionProgress', () => {
    expect(transitionProgress(0, 900, 900)).toBe(0)
    expect(transitionProgress(720, 900, 900)).toBe(1)
    expect(transitionProgress(382.5, 900, 900)).toBeCloseTo(0.5, 9)
    expect(transitionProgress(5000, 900, 900)).toBe(1)
  })
  it('smootherstep', () => {
    expect(smootherstep(0)).toBe(0)
    expect(smootherstep(0.5)).toBe(0.5)
    expect(smootherstep(1)).toBe(1)
    expect(smootherstep(0.25)).toBeCloseTo(0.103515625, 9)
  })
})

describe('placementAt', () => {
  const W = 1440
  const H = 900
  const P = computePlacements(W, H)
  const kinds: PlacementKind[] = ['hero', 'left', 'right', 'left', 'badge', 'outro']
  const sections = kinds.map((kind, i) => ({ top: i * 1200, kind }))
  it('at the top it is the hero placement', () => {
    const r = placementAt(0, H, sections, P)
    expect(r.current).toBe(0)
    expect(r.st.x).toBe(P.hero.x)
    expect(r.st.b).toBe(0)
  })
  it('jump deep into the last section returns outro exactly', () => {
    const r = placementAt(5 * 1200, H, sections, P)
    expect(r.current).toBe(5)
    expect(r.st.x).toBe(P.outro.x)
    expect(r.st.y).toBe(P.outro.y)
    expect(r.st.S).toBe(P.outro.S)
    expect(r.st.talk).toBe(P.outro.talk)
    expect(r.st.b).toBe(0)
  })
  it('jump into the badge section returns badge exactly with b = 1', () => {
    const r = placementAt(4 * 1200, H, sections, P)
    expect(r.current).toBe(4)
    expect(r.st.x).toBe(P.badge.x)
    expect(r.st.S).toBe(P.badge.S)
    expect(r.st.b).toBe(1)
    expect(r.st.cx).toBe(P.badge.cx)
    expect(r.st.d).toBe(P.badge.d)
  })
  it('midway through a boundary blends by smootherstep and flips current past 0.5', () => {
    const top = 1200
    const scrollY = top + 0.5 * 0.75 * H - 0.95 * H // p = 0.5
    const r = placementAt(scrollY, H, sections, P)
    expect(r.st.x).toBeCloseTo((P.hero.x + P.left.x) / 2, 9)
    expect(r.st.S).toBeCloseTo((P.hero.S + P.left.S) / 2, 9)
    expect(r.current).toBe(0) // p must exceed 0.5
    const r2 = placementAt(scrollY + 1, H, sections, P)
    expect(r2.current).toBe(1)
  })
})
