import { expect, test, type Page } from '@playwright/test'
import { expectInside, playSampled, startSampling, stopSampling, type Sample } from './sampling'

/**
 * Badge boundaries (spec §7.5, ruling R20): parked part-way into Experience (he shrinks into the badge)
 * and into Contact (he grows out of it), every frame of the automatic gesture and of a played dance
 * keeps him off the left, right and top edge — silhouette and rendered dots — unless the badge's clip
 * circle alone keeps him inside the window.
 */
type EngineWindow = Window & {
  __engine?: { debugState(): { action: string | null; placement: string } }
  __samples?: Sample[]
}

const engineReady = (page: Page) => page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 8000 })
const frames = (page: Page, n = 2) =>
  page.evaluate(
    (n) =>
      new Promise<void>((r) => {
        let k = 0
        const f = () => (++k >= n ? r() : requestAnimationFrame(f))
        requestAnimationFrame(f)
      }),
    n,
  )

/** Section k of the home page (main > [data-place]): 5 = Experience (badge), 6 = Contact (outro). */
const BOUNDARIES = [
  { name: 'Experience', index: 5, place: 'badge', gesture: 'thumbs' },
  { name: 'Contact', index: 6, place: 'outro', gesture: 'wave' },
] as const
const PS = [0.3, 0.55, 0.7, 0.85]

/** Samples every frame until the gesture playing now (or starting on the next frames) has ended; ≥ 30 frames. */
async function sampleGesture(page: Page) {
  await startSampling(page)
  await page.waitForFunction(
    () => {
      const s = (window as EngineWindow).__samples!
      const seen = s.some((x) => x[6] !== null)
      return s.length >= 30 && (!seen || s[s.length - 1][6] === null)
    },
    null,
    { timeout: 60_000 },
  )
  return stopSampling(page)
}

test.describe.configure({ mode: 'parallel' })

for (const vp of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
  { width: 1440, height: 900 },
  { width: 320, height: 568 },
])
  for (const b of BOUNDARIES)
    test(`into ${b.name} ${vp.width}×${vp.height}: p ${PS.join('/')}, the automatic gesture and a dance stay off the edges`, async ({
      page,
    }) => {
      test.setTimeout(240_000)
      await page.setViewportSize(vp)
      await page.goto('/')
      await engineReady(page)
      const W = await page.evaluate(() => document.documentElement.clientWidth)
      for (const p of PS) {
        const { y, max } = await page.evaluate(
          ([i, p]) => {
            const s = document.querySelectorAll<HTMLElement>('main > [data-place]')[i]
            const top = s.getBoundingClientRect().top + scrollY
            return {
              y: Math.round(top - 0.95 * innerHeight + p * 0.75 * innerHeight),
              max: document.documentElement.scrollHeight - innerHeight,
            }
          },
          [b.index, p] as const,
        )
        expect(y, `p ${p} is reachable`).toBeLessThanOrEqual(max)
        // from the top, so the boundary's own gesture fires on arrival (p > 0.5)
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await frames(page)
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y)
        const label = `${b.name} p ${p}`
        const auto = await sampleGesture(page)
        if (p > 0.5) {
          expect(auto.at(-1)![7], `${label}: placement`).toBe(b.place)
          expect(auto.some((s) => s[6] === b.gesture), `${label}: ${b.gesture} played`).toBe(true)
        }
        expectInside(`${label} (automatic gesture)`, auto, W)
        expectInside(`${label} (dance)`, await playSampled(page, 'dance', 90_000), W)
      }
    })

// R20 hand-over: where containment takes over from the badge clip (or gives way to it), he never jumps.
// Leaving the badge mid-dance is the worst case: his arms reach past the window edge inside the clip.
for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
])
  test(`out of the badge into Contact mid-dance ${vp.width}×${vp.height}: no jump where containment takes over`, async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await engineReady(page)
    const rows = await page.evaluate(async () => {
      type E = { debugState(): { minX: number; maxX: number; action: string | null; clipContained: boolean }; play(a: string): void }
      const engine = (window as unknown as { __engine: E }).__engine
      const raf = () => new Promise((r) => requestAnimationFrame(r))
      const s = document.querySelectorAll<HTMLElement>('main > [data-place]')[6]
      const top = s.getBoundingClientRect().top + scrollY
      const yAt = (p: number) => Math.round(top - 0.95 * innerHeight + p * 0.75 * innerHeight)
      scrollTo({ top: yAt(0), behavior: 'instant' })
      while (engine.debugState().action !== null) await raf()
      for (let i = 0; i < 30; i++) await raf()
      engine.play('dance')
      const out: { c: number; clip: boolean; action: string | null }[] = []
      for (let i = 0; i <= 80; i++) {
        scrollTo({ top: yAt((0.2 * i) / 80), behavior: 'instant' })
        await raf()
        await raf()
        const d = engine.debugState()
        out.push({ c: (d.minX + d.maxX) / 2, clip: d.clipContained, action: d.action })
      }
      return out
    })
    expect(rows[0].clip, 'starts clipped by the badge').toBe(true)
    const handover = rows.findIndex((r) => !r.clip)
    expect(handover, 'containment takes over within p 0.2').toBeGreaterThan(0)
    expect(rows[handover].action, 'still dancing at the hand-over').toBe('dance')
    const steps = rows.slice(1).map((r, i) => Math.abs(r.c - rows[i].c))
    // the slide itself moves him ≤ ~4 px per step here; the old switch jumped 27–37 px
    expect(Math.max(...steps), `largest step ${Math.max(...steps).toFixed(1)} px`).toBeLessThanOrEqual(12)
  })
