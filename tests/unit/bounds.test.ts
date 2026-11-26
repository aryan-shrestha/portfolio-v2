import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, HAIR_STYLES, OUTFITS, type Look } from '@/engine/look'
import { ALL_KINDS, TOP_KINDS, measureBounds, type Bounds } from '@/engine/measure'
import { BOX, WIDEST_HELD, WIDEST_TOTAL, widestFor } from '@/engine/placement'
import type { HairStyle, OutfitId } from '@/engine/types'

/**
 * Containment budget for every hair style × outfit (spec §7.5.4, §7.6; ruling R13 generalised).
 * Colours never change bounds, so the default colours stand in for all of them. Each pose kind is
 * simulated at 60 fps from a settled idle with the runtime's damping and elbow fold (engine/measure).
 *
 * - Width: the widest total silhouette of any frame of any kind ≤ widestFor(outfit) (phones size to it):
 *   WIDEST_TOTAL, or WIDEST_HELD for the outfits holding a prop in the fist.
 * - Top: the highest point over idle, wave, dance, panic and drag ≤ BOX.y1 (sizing uses it). The other
 *   kinds may pass it by their own lift (fly hovers); the runtime clamp nudges him down (§7.5.1).
 * Both constants are the measured maxima (+ margin), pinned by the last two tests.
 */
const combos = HAIR_STYLES.flatMap((hair) => OUTFITS.map((outfit) => [hair, outfit] as const))
const lookOf = (hair: HairStyle, outfit: OutfitId): Look => ({ base: { ...DEFAULT_LOOK.base, hair }, outfit })

const widths = new Map<string, Bounds>()
const tops = new Map<string, Bounds>()
const key = (h: string, o: string) => `${h} × ${o}`

describe('every hair × outfit stays inside the containment budget', () => {
  for (const [hair, outfit] of combos) {
    it(`${key(hair, outfit)}: width ≤ widestFor(outfit) over every pose, top ≤ BOX.y1`, { timeout: 60_000 }, () => {
      const look = lookOf(hair, outfit)
      const top = measureBounds(look, TOP_KINDS)
      const all = measureBounds(look, ALL_KINDS)
      tops.set(key(hair, outfit), top)
      widths.set(key(hair, outfit), all)
      expect(top.y1, 'top over idle/wave/dance/panic/drag').toBeLessThanOrEqual(BOX.y1)
      expect(all.width, 'widest frame of any pose').toBeLessThanOrEqual(widestFor(outfit))
      // any other pose passes the bound only by how far it lifts his body (fly, hops)
      expect(all.y1Grounded, 'top of any pose, less its body lift').toBeLessThanOrEqual(BOX.y1)
    })
  }

  for (const [name, value] of [
    ['WIDEST_TOTAL', WIDEST_TOTAL],
    ['WIDEST_HELD', WIDEST_HELD],
  ] as const)
    it(`${name} is the measured maximum of its outfits + 0.1, rounded up to 0.05 (not padded beyond that)`, () => {
      expect(widths.size).toBe(combos.length)
      const mine = combos.filter(([, o]) => widestFor(o) === value)
      expect(mine.length).toBeGreaterThan(0)
      const max = Math.max(...mine.map(([h, o]) => widths.get(key(h, o))!.width))
      expect(value).toBeCloseTo(Math.ceil((max + 0.1) / 0.05 - 1e-9) * 0.05, 9)
    })

  it('BOX.y1 is the measured maximum top, rounded up to 0.05', () => {
    expect(tops.size).toBe(combos.length)
    const max = Math.max(...[...tops.values()].map((b) => b.y1))
    expect(BOX.y1).toBeCloseTo(Math.ceil(max / 0.05 - 1e-9) * 0.05, 9)
  })
})

afterAll(() => {
  if (!process.env.BOUNDS_TABLE) return
  const rows = combos.map(([h, o]) => {
    const t = tops.get(key(h, o))
    const w = widths.get(key(h, o))
    const f = (n?: number) => (n === undefined ? '—' : n.toFixed(3))
    return `| ${h} | ${o} | ${f(w?.width)} | ${f(w?.x0)} | ${f(w?.x1)} | ${f(t?.y1)} | ${f(w?.y1)} | ${f(w?.y1Grounded)} |`
  })
  console.log(
    [
      '| hair | outfit | widest frame | min x | max x | top (5 kinds) | top (all, incl. lift) | top (all, less lift) |',
      '|---|---|---|---|---|---|---|---|',
      ...rows,
    ].join('\n'),
  )
})
