import { expect, test } from '@playwright/test'
import { startSampling, stopSampling, type Sample } from './sampling'

/**
 * Clip regression for every outfit × hair style (spec §7.6, §10; review fix): idle, panic, cheer and
 * dance sampled on every frame, on the hero and on the dress-up stage, at 390×844 and 1440×900. No
 * frame may touch the left, right or top edge. The look is set through the engine (the same calls the
 * dress-up page makes), so one page load covers four hair styles. Tests run in parallel.
 */
type EngineWindow = Window & {
  __engine?: {
    debugState(): { outfit: string; placement: string; action: string | null }
    play(a: string): void
    setLook(base: Record<string, unknown>): void
    setOutfit(id: string): void
  }
}

const OUTFITS = ['hoodie', 'blazer-bowtie', 'hardhat', 'detective']
const HAIR = ['wavy-fringe', 'short-crop', 'curly-top', 'buzz']
const BASE = { hairColor: '#3a2f28', skin: '#efc6a2', hoodie: '#55555c', glasses: true }
/** seconds each move is sampled: its whole duration plus the return to idle */
const MOVES: [string, number][] = [
  ['panic', 2.9],
  ['cheer', 2.7],
  ['dance', 4.3],
]

test.describe.configure({ mode: 'parallel' })

for (const vp of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
])
  for (const [where, url, placement] of [
    ['hero', '/', 'hero'],
    ['dress-up stage', '/dress-up', 'stage'],
  ] as const)
    for (const outfit of OUTFITS)
      test(`${where} ${vp.width}×${vp.height}, ${outfit}: every frame of idle/panic/cheer/dance inside, every hair style`, async ({
        page,
      }) => {
        test.setTimeout(120_000)
        await page.setViewportSize(vp)
        await page.goto(url)
        await page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 8000 })
        await page.waitForFunction((p) => (window as EngineWindow).__engine!.debugState().placement === p, placement)
        await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null, null, {
          timeout: 8000,
        })
        const W = await page.evaluate(() => document.documentElement.clientWidth)
        let frames = 0
        const check = (label: string, samples: Sample[]) => {
          // every rendered frame is sampled; under parallel software GL a frame can take ~100 ms
          expect(samples.length, `${label}: frames sampled`).toBeGreaterThanOrEqual(4)
          frames += samples.length
          samples.forEach(([minX, maxX, top], i) => {
            expect(minX, `${label} frame ${i} left`).toBeGreaterThanOrEqual(0)
            expect(maxX, `${label} frame ${i} right`).toBeLessThanOrEqual(W)
            expect(top, `${label} frame ${i} top`).toBeGreaterThanOrEqual(0)
          })
        }
        for (const hair of HAIR) {
          await page.evaluate(
            ([hair, outfit, base]) => {
              const e = (window as EngineWindow).__engine!
              e.setLook({ ...base, hair })
              e.setOutfit(outfit)
            },
            [hair, outfit, BASE] as const,
          )
          await page.waitForFunction((o) => (window as EngineWindow).__engine!.debugState().outfit === o, outfit)
          await startSampling(page)
          await page.waitForTimeout(800)
          check(`${hair} idle`, await stopSampling(page))
          for (const [move, seconds] of MOVES) {
            await startSampling(page)
            await page.evaluate((m) => (window as EngineWindow).__engine!.play(m), move)
            await page.waitForTimeout(seconds * 1000)
            check(`${hair} ${move}`, await stopSampling(page))
          }
        }
        test.info().annotations.push({ type: 'frames', description: String(frames) })
      })
