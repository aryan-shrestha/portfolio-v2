import { describe, expect, it } from 'vitest'
import { DURATION, hasPose, poseFor } from '@/engine/poses'
import { CASE_COMMENTS, QUIPS } from '@/engine/quips'

const ctx = { now: 0, toward: 1 as const, vx: 0 }

describe('poseFor', () => {
  it('idle: arms hang just off the body, smile, breathing bob from ctx.now', () => {
    const p = poseFor('idle', 0, ctx)
    expect(p.sh).toEqual([-0.14, 0.14])
    expect(p.el).toEqual([0, 0])
    expect(p.open).toBe(false)
    expect(p.wide).toBe(false)
    expect(poseFor('idle', 0, { ...ctx, now: Math.PI / 3.2 }).bodyY).toBeCloseTo(0.02)
  })

  it('wave raises the left arm over the head with a waggling elbow', () => {
    const p = poseFor('wave', 0.3, ctx)
    expect(p.sh[0]).toBe(-2.55)
    expect(p.el[0]).toBeCloseTo(-(0.3 + 0.45 * Math.sin(0.3 * 13)))
    expect(p.sh[1]).toBe(0.14)
    expect(p.open).toBe(true)
  })

  it('point and thumbs use the arm on the screens side', () => {
    expect(poseFor('point', 0, { ...ctx, toward: 1 }).sh).toEqual([-0.14, 1.5])
    expect(poseFor('point', 0, { ...ctx, toward: -1 }).sh).toEqual([-1.5, 0.14])
    expect(poseFor('thumbs', 0, { ...ctx, toward: -1 }).sh[0]).toBe(-0.7)
  })

  it('drag flails both arms upward, open-eyed, tilting against the velocity', () => {
    const p = poseFor('drag', 0, { ...ctx, vx: 10 })
    expect(p.sh[0]).toBeLessThan(-2)
    expect(p.sh[1]).toBeGreaterThan(2)
    expect(p.wide).toBe(true)
    expect(p.bodyZ).toBeCloseTo(-0.2)
    expect(poseFor('drag', 0, { ...ctx, vx: 100 }).bodyZ).toBe(-0.3)
  })

  it('every timed pose lasts 1.5–4 s', () => {
    for (const [, d] of Object.entries(DURATION)) {
      expect(d).toBeGreaterThanOrEqual(1.5)
      expect(d).toBeLessThanOrEqual(4)
    }
    expect(Object.keys(DURATION).sort()).toEqual(['cheer', 'dance', 'panic', 'point', 'think', 'thumbs', 'wave'])
  })

  it('hasPose covers the gestures and the actions built so far', () => {
    expect(hasPose('wave')).toBe(true)
    expect(hasPose('cheer')).toBe(true)
    expect(hasPose('fly')).toBe(false)
  })
})

describe('quips', () => {
  it('has the hero, outro and copy lines verbatim', () => {
    expect(QUIPS.hero).toBe("Hi, I'm <b>Aryan</b>. Scroll down and I'll show you around.")
    expect(QUIPS.outro).toBe('Got something to build? <b>Say hi.</b>')
    expect(QUIPS.copied).toBe('Copied! Talk soon.')
  })

  it('has one comment per case study', () => {
    expect(Object.keys(CASE_COMMENTS).sort()).toEqual(['bevlytics', 'data-to-insights', 'napa-valley-weddings'])
    expect(CASE_COMMENTS.bevlytics).toBe('The data had opinions.')
  })
})
