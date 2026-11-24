import { expect, test, type Page } from '@playwright/test'
import { expectInside, sampledFrames, screenshotEdges, showPage, startSampling, stopSampling, widest, type Sample } from './sampling'

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
          for (const [move, seconds] of MOVES) {
            await startSampling(page)
            await page.evaluate((m) => (window as EngineWindow).__engine!.play(m), move)
            await page.waitForTimeout(seconds * 1000)
            check(`${hair} ${move}`, await stopSampling(page))
          }
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
const ACTIONS: [string, number][] = [
  ['wave', 2.2],
  ['dance', 4],
  ['panic', 2.6],
  ['fly', 3.2],
  ['vanish', 2.6],
  ['hiccup', 2.6],
  ['peekaboo', 3],
  ['selfie', 3],
  ['dizzy', 3.4],
  ['sneeze', 2.8],
  ['sulk', 3.4],
  ['deploying', 4],
]
type MatrixWindow = Window & {
  __engine?: { debugState(): { action: string | null; placement: string }; play(a: string): void }
}
const ready = async (page: Page) => {
  await page.waitForFunction(() => !!(window as MatrixWindow).__engine, null, { timeout: 8000 })
  await page.waitForFunction(() => (window as MatrixWindow).__engine!.debugState().action === null, null, { timeout: 8000 })
}
const clientW = (page: Page) => page.evaluate(() => document.documentElement.clientWidth)
async function playSampled(page: Page, action: string, seconds: number) {
  await startSampling(page)
  await page.evaluate((a) => (window as MatrixWindow).__engine!.play(a), action)
  await page.waitForTimeout(seconds * 1000 + 400)
  return stopSampling(page)
}
/** Replays `action` and scans the screenshot edges every ~120 ms over its duration: zero character pixels. */
async function scanWhilePlaying(page: Page, action: string, seconds: number, label: string) {
  await page.evaluate((a) => (window as MatrixWindow).__engine!.play(a), action)
  const end = Date.now() + seconds * 1000
  let shots = 0
  while (Date.now() < end) {
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
  return shots
}

for (const vp of VIEWPORTS) {
  const name = `${vp.width}×${vp.height}`

  test(`matrix ${name}: idle and each of the 12 actions, every frame inside; edge screenshots at the widest`, async ({
    page,
  }) => {
    test.setTimeout(150_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await ready(page)
    const W = await clientW(page)
    await startSampling(page)
    await sampledFrames(page, 8)
    expectInside(`${name} idle`, await stopSampling(page), W)
    let wide: [string, number, number] = ['idle', 0, 0]
    for (const [a, sec] of ACTIONS) {
      const samples = await playSampled(page, a, sec)
      expectInside(`${name} ${a}`, samples, W)
      const w = samples[widest(samples)]
      if (w[1] - w[0] > wide[2]) wide = [a, sec, w[1] - w[0]]
      await ready(page)
    }
    const shots = await scanWhilePlaying(page, wide[0], wide[1], `${name} widest (${wide[0]})`)
    test.info().annotations.push({ type: 'widest', description: `${wide[0]} ${wide[2].toFixed(0)} px, ${shots} edge shots` })
  })

  test(`matrix ${name}: dragged to each corner and 300 px beyond, every frame inside`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await ready(page)
    const W = await clientW(page)
    const H = vp.height
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
      await page.waitForTimeout(1300) // the spring back
      expectInside(`${name} drag ${corner}`, await stopSampling(page), W)
      await page.keyboard.press('Escape')
    }
  })

  test(`matrix ${name}: dance pinned to the left and the right edge, every frame inside; edge screenshots`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
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
      const samples = await playSampled(page, 'dance', 4)
      expectInside(`${name} dance pinned ${place}`, samples, W)
      await ready(page)
      await scanWhilePlaying(page, 'dance', 2, `${name} dance pinned ${place}`)
    }
  })
}
