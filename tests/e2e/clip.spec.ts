import { expect, test, type Page } from '@playwright/test'
import { DURATION } from '../../engine/poses'
import type { Action } from '../../engine/types'
import {
  expectInside,
  playSampled,
  sampledFrames,
  screenshotEdges,
  showPage,
  startSampling,
  stopSampling,
  widest,
  type Sample,
} from './sampling'

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
/** the widest moves (spec §7.6: idle + the 3 widest actions per look), each sampled from play until idle again */
const MOVES = ['panic', 'cheer', 'dance']

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
        test.setTimeout(300_000)
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
          expectInside(label, samples, W)
          frames += samples.length
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
          await sampledFrames(page, 8)
          check(`${hair} idle`, await stopSampling(page))
          for (const move of MOVES) check(`${hair} ${move}`, await playSampled(page, move))
        }
        test.info().annotations.push({ type: 'frames', description: String(frames) })
      })

/**
 * The full clip matrix (spec §10a; R15): 7 viewports × {idle, each of the 12 actions, a mouse drag to
 * each corner and 300 px beyond, dance pinned to the left and the right edge}. Every frame is sampled
 * (silhouette + the canvas's own edge dots); then the widest moment of each viewport is replayed under a
 * screenshot scan of the window's edge column/row, to catch outline or dither overreach past Box3.
 */
const VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1280, height: 600 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]
/** The action menu's twelve (spec §7.4); their lengths come from the engine (DURATION), not copied here. */
const ACTIONS: Action[] = ['wave', 'dance', 'panic', 'fly', 'vanish', 'hiccup', 'peekaboo', 'selfie', 'dizzy', 'sneeze', 'sulk', 'deploying']
type MatrixWindow = Window & {
  __engine?: { debugState(): { action: string | null; placement: string; S: number; top: number }; play(a: string): void }
}
const action = (page: Page) => page.evaluate(() => (window as MatrixWindow).__engine!.debugState().action)
/** He is loaded and idle (generous: slow software GL stretches an action past its duration). */
const ready = async (page: Page) => {
  await page.waitForFunction(() => !!(window as MatrixWindow).__engine, null, { timeout: 15_000 })
  await page.waitForFunction(() => (window as MatrixWindow).__engine!.debugState().action === null, null, { timeout: 60_000 })
}
const clientW = (page: Page) => page.evaluate(() => document.documentElement.clientWidth)
/** Replays `a` and scans the screenshot edges every ~120 ms until it has ended: zero character pixels. */
async function scanWhilePlaying(page: Page, a: string, label: string) {
  await page.evaluate((a) => (window as MatrixWindow).__engine!.play(a), a)
  let shots = 0
  while (shots === 0 || (await action(page)) === a) {
    const e = await screenshotEdges(page)
    expect(e, `${label}: screenshot pixels of him on the [left, right, top] edge (shot ${shots})`).toEqual({
      left: 0,
      right: 0,
      top: 0,
    })
    shots++
    await page.waitForTimeout(120)
  }
  await showPage(page)
  await ready(page)
  return shots
}

for (const vp of VIEWPORTS) {
  const name = `${vp.width}×${vp.height}`

  test(`matrix ${name}: idle and each of the 12 actions, every frame inside; edge screenshots at the widest`, async ({
    page,
  }) => {
    test.setTimeout(400_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await ready(page)
    const W = await clientW(page)
    await startSampling(page)
    await sampledFrames(page, 8)
    expectInside(`${name} idle`, await stopSampling(page), W)
    // the widest action (the selfie's flash lights the whole window on purpose, so it is not replayed)
    let wide: [string, number] = ['dance', 0]
    for (const a of ACTIONS) {
      const samples = await playSampled(page, a, Math.max(60_000, DURATION[a] * 15_000))
      expectInside(`${name} ${a}`, samples, W)
      const w = samples[widest(samples)]
      if (a !== 'selfie' && w[1] - w[0] > wide[1]) wide = [a, w[1] - w[0]]
      await ready(page)
    }
    const shots = await scanWhilePlaying(page, wide[0], `${name} widest (${wide[0]})`)
    test.info().annotations.push({ type: 'widest', description: `${wide[0]} ${wide[1].toFixed(0)} px, ${shots} edge shots` })
  })

  test(`matrix ${name}: dragged to each corner and 300 px beyond, every frame inside, held at the clamp`, async ({
    page,
  }) => {
    test.setTimeout(180_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await ready(page)
    const W = await clientW(page)
    const H = vp.height
    // containment padding (runtime contain()): outline + 2 dither cells; the clamp holds him this far in
    const { S, top: restTop } = await page.evaluate(() => (window as MatrixWindow).__engine!.debugState())
    const pad = 0.06 * S + 2 * (W < 600 ? 2 : 3)
    const SLACK = 3
    const handle = page.locator('[data-char="handle"]')
    for (const [cx, cy, corner] of [
      [0, 0, 'top-left'],
      [W, 0, 'top-right'],
      [0, H, 'bottom-left'],
      [W, H, 'bottom-right'],
    ] as const) {
      const box = (await handle.boundingBox())!
      const x = box.x + box.width / 2
      const y = box.y + box.height / 2
      await startSampling(page)
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(cx, cy, { steps: 12 })
      const bx = cx === 0 ? -300 : W + 300
      const by = cy === 0 ? -300 : H + 300
      await page.mouse.move(bx, by, { steps: 8 })
      await page.waitForTimeout(300)
      await page.mouse.up()
      // the spring back: until he rests where he started (polling, not a fixed wait)
      // (within his breathing bob, ±0.02 S)
      await page.waitForFunction(
        ([t, tol]) => Math.abs((window as MatrixWindow).__engine!.debugState().top - t) < tol,
        [restTop, 0.03 * S + 2] as const,
        { timeout: 30_000 },
      )
      const samples = await stopSampling(page)
      expectInside(`${name} drag ${corner}`, samples, W)
      // the drag engaged and ran him into the clamp on the corner's side (and up, or down past the bottom)
      if (cx === 0) expect(Math.min(...samples.map((s) => s[0])), `${corner}: reached the left clamp`).toBeLessThanOrEqual(pad + SLACK)
      else expect(Math.min(...samples.map((s) => W - s[1])), `${corner}: reached the right clamp`).toBeLessThanOrEqual(pad + SLACK)
      if (cy === 0) expect(Math.min(...samples.map((s) => s[2])), `${corner}: reached the top clamp`).toBeLessThanOrEqual(pad + SLACK)
      else expect(Math.max(...samples.map((s) => s[2])), `${corner}: carried down`).toBeGreaterThan(restTop + 100)
    }
  })

  test(`matrix ${name}: dance pinned to the left and the right edge, every frame inside; edge screenshots`, async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await ready(page)
    const W = await clientW(page)
    // About is `left`, chapter 2 is `right`: dance's ±2.8 swing runs into the margin and the clamp holds him.
    for (const [section, place] of [
      [1, 'left'],
      [3, 'right'],
    ] as const) {
      await page.evaluate((i) => {
        const s = document.querySelectorAll<HTMLElement>('main > section')[i]
        window.scrollTo(0, s.offsetTop + innerHeight * 0.3)
      }, section)
      await expect.poll(() => page.evaluate(() => (window as MatrixWindow).__engine!.debugState().placement)).toBe(place)
      await ready(page)
      const samples = await playSampled(page, 'dance')
      expectInside(`${name} dance pinned ${place}`, samples, W)
      // pinned: the clamp held him on that edge for part of the dance
      const gap = place === 'left' ? Math.min(...samples.map((s) => s[0])) : Math.min(...samples.map((s) => W - s[1]))
      const S = await page.evaluate(() => (window as MatrixWindow).__engine!.debugState().S)
      expect(gap, `dance reached the ${place} clamp`).toBeLessThanOrEqual(0.06 * S + 2 * (W < 600 ? 2 : 3) + 3)
      await ready(page)
      await scanWhilePlaying(page, 'dance', `${name} dance pinned ${place}`)
    }
  })
}
