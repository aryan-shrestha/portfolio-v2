import { expect, test, type Page } from '@playwright/test'
import { expectInside, startSampling, stopSampling } from './sampling'

/**
 * Scroll tour (spec §6.1, §10b): 5 viewports × 31 evenly spaced scroll positions over the whole home
 * page. At each: he is inside the window (silhouette and rendered dots) unless he is the badge, at
 * most one narration line is on, and his placement is the one of the section in view (p > 0.5 into
 * section k). Over the tour the sections come in order: hero → left → left → right → left → badge → outro.
 */
type Debug = {
  minX: number
  maxX: number
  top: number
  placement: string
  action: string | null
  edge: [number, number, number]
}
type EngineWindow = Window & { __engine?: { debugState(): Debug; debugProbe(on: boolean): void } }

const engineReady = (page: Page) => page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 8000 })
const debug = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugState())
const frames = (page: Page, n = 3) =>
  page.evaluate(
    (n) => new Promise<void>((r) => {
      let k = 0
      const f = () => (++k >= n ? r() : requestAnimationFrame(f))
      requestAnimationFrame(f)
    }),
    n,
  )
/** Index of the section in view by the spec's rule (p = (scrollY + 0.95H − top) / 0.75H > 0.5). */
const sectionInView = (page: Page) =>
  page.evaluate(() => {
    const H = innerHeight
    const secs = [...document.querySelectorAll<HTMLElement>('[data-place]')].filter((s) => s.getClientRects().length)
    let cur = 0
    secs.forEach((s, k) => {
      const top = s.getBoundingClientRect().top + scrollY
      if (k > 0 && (scrollY + 0.95 * H - top) / (0.75 * H) > 0.5) cur = k
    })
    return { index: cur, place: secs[cur].dataset.place! }
  })

const ORDER = ['hero', 'left', 'left', 'right', 'left', 'badge', 'outro']

test.describe.configure({ mode: 'parallel' })

for (const vp of [
  { width: 1440, height: 900 },
  { width: 1280, height: 600 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
])
  test(`tour ${vp.width}×${vp.height}: 31 scroll positions, inside the window, ≤ 1 line on, the right placement`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await engineReady(page)
    await page.evaluate(() => (window as EngineWindow).__engine!.debugProbe(true))
    const W = await page.evaluate(() => document.documentElement.clientWidth)
    const max = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    const visited: number[] = []
    for (let i = 0; i <= 30; i++) {
      const y = Math.round((max * i) / 30)
      await page.evaluate((y) => window.scrollTo(0, y), y)
      await frames(page)
      const at = `scrollY ${y} (${i}/30)`
      const view = await sectionInView(page)
      const d = await debug(page)
      expect(d.placement, `${at}: placement`).toBe(view.place)
      if (d.placement !== 'badge') {
        expect(d.minX, `${at}: left`).toBeGreaterThanOrEqual(0)
        expect(d.maxX, `${at}: right`).toBeLessThanOrEqual(W)
        expect(d.top, `${at}: top`).toBeGreaterThanOrEqual(0)
        expect(d.edge, `${at}: rendered dots on the [left, right, top] edge`).toEqual([0, 0, 0])
      }
      expect(await page.locator('.line.on').count(), `${at}: lines on`).toBeLessThanOrEqual(1)
      if (visited.at(-1) !== view.index) visited.push(view.index)
    }
    expect(visited, 'every section, in order').toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(
      await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('main > [data-place]')].map((s) => s.dataset.place)),
    ).toEqual(ORDER)
  })

test('resize mid-chapter 1440×900 → 390×844: inside the window 500 ms later, and every frame after', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await engineReady(page)
  await page.evaluate(() => {
    const s = document.querySelectorAll<HTMLElement>('main > section')[3] // chapter 2 (Bevlytics)
    window.scrollTo(0, s.offsetTop + innerHeight * 0.5)
  })
  await expect.poll(async () => (await debug(page)).placement).toBe('right')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  await page.evaluate(() => (window as EngineWindow).__engine!.debugProbe(true))
  await frames(page)
  const d = await debug(page)
  expect(d.minX).toBeGreaterThanOrEqual(0)
  expect(d.maxX).toBeLessThanOrEqual(390)
  expect(d.top).toBeGreaterThanOrEqual(0)
  expect(d.edge).toEqual([0, 0, 0])
  await startSampling(page)
  await page.waitForTimeout(500)
  expectInside('after the resize', await stopSampling(page), 390)
})

test('anchor jump: "Get in touch ↓" lands on the outro within 1.5 s and plays only its wave (N11)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await engineReady(page)
  // the load wave first finishes, so any wave after the click is the destination's
  await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null, null, { timeout: 8000 })
  await startSampling(page)
  await page.getByRole('link', { name: 'Get in touch ↓' }).click()
  await expect.poll(async () => (await debug(page)).placement, { timeout: 1500 }).toBe('outro')
  await page.waitForTimeout(2600) // the wave's 2.2 s, and then some
  const samples = await stopSampling(page)
  const actions = new Set(samples.map((s) => s[6]).filter((a) => a !== null))
  expect([...actions], 'only the destination gesture plays').toEqual(['wave'])
  // and it plays once he is there, not on the way (the jump skips the sections in between)
  const firstWave = samples.findIndex((s) => s[6] === 'wave')
  expect(samples[firstWave][7]).toBe('outro')
})
