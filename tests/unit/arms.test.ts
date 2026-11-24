import { describe, expect, it } from 'vitest'
import { elbowTarget } from '@/engine/arms'

describe('elbowTarget', () => {
  it('folds 1.6*sin|theta| while the arm swings through horizontal', () => {
    const v = elbowTarget(Math.PI / 2, 2.55, -0.3, -1)
    expect(Math.abs(v)).toBeCloseTo(1.6, 9)
    expect(v).toBeGreaterThan(0) // sign follows the swing angle
  })
  it('uses the gesture elbow once arrived', () => {
    expect(elbowTarget(2.55, 2.55, -0.3, -1)).toBe(-0.3)
  })
  it('keeps the gesture elbow when it is already more bent than the fold', () => {
    expect(elbowTarget(0.2, 2.55, -1.5, 1)).toBe(-1.5)
  })
  it('uses side for the sign when the shoulder is at 0', () => {
    expect(elbowTarget(0, 1, 0, -1)).toBeCloseTo(0, 9) // fold = 1.6*sin 0 = 0 -> gesture value
    expect(elbowTarget(-0.001, 1, 0, 1)).toBeLessThan(0)
  })
  it('within 0.35 of the target has not folded', () => {
    expect(elbowTarget(1.0, 1.3, -0.3, 1)).toBe(-0.3)
  })
})
