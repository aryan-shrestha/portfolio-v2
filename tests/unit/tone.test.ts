import { describe, expect, it } from 'vitest'
import { SWATCHES } from '@/engine/look'
import { ditherColours, ditherLevel } from '@/engine/render/tone'

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

/**
 * Colour dither (v1.2, owner): dots take the surface's hue, the gaps a light tint of it, so a visitor's
 * hair, skin and hoodie picks show. Neutral colours stay ink dots on white, as before.
 */
describe('colour dither: dots and gaps carry the colour', () => {
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
  const INK = [0x11 / 255, 0x11 / 255, 0x10 / 255]

  it('neutral colours (outline ink, greys, white) stay ink dots on white gaps', () => {
    for (const h of ['#111110', '#55555c', '#1f1f22', '#9aa0a6', '#ffffff']) {
      const { dot, gap } = ditherColours(h)
      expect(dist(dot, INK), `${h} dot`).toBeLessThan(0.08)
      expect(dist(gap, [1, 1, 1]), `${h} gap`).toBeLessThan(0.08)
    }
  })

  it('each coloured hoodie shows its own hue in the dots', () => {
    const [r, g, b] = [0, 1, 2]
    const dominant = (h: string) => {
      const { dot } = ditherColours(h)
      return dot.indexOf(Math.max(...dot))
    }
    expect(dominant('#2f4a6b')).toBe(b) // navy
    expect(dominant('#6b2f3a')).toBe(r) // maroon
    expect(dominant('#3f5a3a')).toBe(g) // green
    const dots = ['#2f4a6b', '#6b2f3a', '#3f5a3a'].map((h) => ditherColours(h).dot)
    for (let i = 0; i < dots.length; i++)
      for (let j = i + 1; j < dots.length; j++) expect(dist(dots[i], dots[j])).toBeGreaterThan(0.1)
  })

  it('every skin swatch tints the gaps warm, so light skin shows too', () => {
    for (const h of SWATCHES.skin) {
      const { gap } = ditherColours(h)
      expect(gap[0] - gap[2], h).toBeGreaterThan(0.08) // warmer than white
      expect(Math.min(...gap), h).toBeGreaterThan(0.45) // still a light tint: dots stay readable on it
    }
  })

  it('the hair swatches are told apart by their dots', () => {
    const dots = SWATCHES.hair.map((h) => ditherColours(h).dot)
    // blond and brown dots are warm (red over blue); black and grey stay ink
    expect(dots[3][0] - dots[3][2]).toBeGreaterThan(0.1) // #b8863b blond
    expect(dots[2][0] - dots[2][2]).toBeGreaterThan(0.05) // #6b4a2b brown
    expect(dist(dots[1], INK)).toBeLessThan(0.08) // #1a1a1a black
  })


})
