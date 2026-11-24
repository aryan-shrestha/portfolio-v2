import { describe, expect, it } from 'vitest'
import { SWATCHES } from '@/engine/look'
import { ditherLevel } from '@/engine/render/tone'

/**
 * Ruling R14: skin renders its true tone. Share of paper dots (the dither shader's `l`) for the face,
 * front-lit and turned away from the key light; the five swatches (light → dark: f7dcc4, efc6a2,
 * d9a47c, a8724f, 6e4630) must stay strictly ordered at every angle. No luminance remap is applied:
 * the facial features get paper rims instead (tests/unit/model.test.ts).
 */
const LIGHT_TO_DARK = ['#f7dcc4', '#efc6a2', '#d9a47c', '#a8724f', '#6e4630']
const FACE = {
  front: [0, 0, 1],
  'turned from the key': [0.6, 0, 0.8],
  'cheek in shadow': [0.8, -0.2, 0.55],
}

describe('skin tones dither in order (ruling R14)', () => {
  it('covers exactly the five skin swatches', () => {
    expect([...SWATCHES.skin].sort()).toEqual([...LIGHT_TO_DARK].sort())
  })

  for (const [where, n] of Object.entries(FACE))
    it(`${where}: strictly ordered light → dark`, () => {
      const l = LIGHT_TO_DARK.map((h) => ditherLevel(h, n))
      for (let i = 1; i < l.length; i++)
        expect(l[i], `${LIGHT_TO_DARK[i]} vs ${LIGHT_TO_DARK[i - 1]}`).toBeLessThan(l[i - 1])
    })

  it('neighbouring tones differ by ≥ 5% of dots where the face turns from the light', () => {
    const l = LIGHT_TO_DARK.map((h) => ditherLevel(h, FACE['turned from the key']))
    for (let i = 1; i < l.length; i++) expect(l[i - 1] - l[i]).toBeGreaterThanOrEqual(0.05)
  })

  it('matches the measured look: Aryan’s own skin is nearly all paper front-on, the darkest about two-thirds ink', () => {
    expect(ditherLevel('#efc6a2')).toBeGreaterThan(0.95)
    expect(1 - ditherLevel('#6e4630')).toBeCloseTo(0.636, 2)
  })
})
