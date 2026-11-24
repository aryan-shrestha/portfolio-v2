import { expect, test, type Page } from '@playwright/test'

type Debug = {
  minX: number
  maxX: number
  top: number
  S: number
  placement: string
  outfit: string
  action: string | null
  geometries: number
}
type EngineWindow = Window & { __engine?: { debugState(): Debug; play(a: string): void }; __marker?: number }

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return () => errors
}
const engineReady = (page: Page) =>
  page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 8000 })
const debug = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugState())
const idle = (page: Page) =>
  page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null, null, { timeout: 8000 })

test('footer "Dress me up" is a client navigation: same character, stage placement', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await engineReady(page)
  await page.evaluate(() => ((window as EngineWindow).__marker = 1))
  await page.evaluate(() => document.getElementById('contact')!.scrollIntoView())
  await page.getByRole('link', { name: 'Dress me up' }).click()
  await expect(page).toHaveURL(/\/dress-up$/)
  await expect.poll(async () => (await debug(page)).placement).toBe('stage')
  expect(await page.evaluate(() => (window as EngineWindow).__marker)).toBe(1)
  expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(1)
})

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`dress-up ${vp.width}×${vp.height}: he stands on his stage, never over the controls, never on an edge`, async ({
    page,
  }) => {
    test.setTimeout(90_000)
    const errors = trackErrors(page)
    await page.setViewportSize(vp)
    await page.goto('/dress-up')
    await engineReady(page)
    await idle(page)
    // the tallest and widest look: a hat on curly hair, a prop in hand
    await page.getByRole('button', { name: 'Curly top', exact: true }).click()
    await page.getByRole('button', { name: 'Hard hat', exact: true }).click()
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect.poll(async () => (await debug(page)).outfit).toBe('hardhat')
    await page.waitForTimeout(600)

    const stage = (await page.locator('[data-stage]').boundingBox())!
    const panel = (await page.getByRole('region', { name: 'Pick a look' }).boundingBox())!
    const rest = await debug(page)
    // centred on the stage area, his top inside it
    expect(Math.abs((rest.minX + rest.maxX) / 2 - (stage.x + stage.width / 2))).toBeLessThan(0.1 * stage.width)
    expect(rest.top).toBeGreaterThanOrEqual(stage.y)
    if (panel.x > stage.x + stage.width / 2)
      expect(rest.maxX).toBeLessThanOrEqual(panel.x) // side panel
    else expect(stage.y + stage.height).toBeLessThanOrEqual(panel.y + 1) // stacked: controls below his floor

    const W = await page.evaluate(() => document.documentElement.clientWidth)
    for (const a of ['panic', 'wave', 'dance']) {
      await page.evaluate((a) => (window as EngineWindow).__engine!.play(a), a)
      for (let i = 0; i < 12; i++) {
        const d = await debug(page)
        expect(d.minX, `${a} left`).toBeGreaterThanOrEqual(0)
        expect(d.maxX, `${a} right`).toBeLessThanOrEqual(W)
        expect(d.top, `${a} top`).toBeGreaterThanOrEqual(0)
        await page.waitForTimeout(150)
      }
      await idle(page)
    }

    // carried to the top-left corner and past it: every sampled frame stays inside (hat included)
    const handle = (await page.locator('[data-char="handle"]').boundingBox())!
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    for (const [x, y] of [
      [2, 2],
      [W - 2, 2],
      [W / 2, 2],
    ]) {
      await page.mouse.move(x, y, { steps: 8 })
      await page.waitForTimeout(250)
      const d = await debug(page)
      expect(d.minX, `drag ${x},${y} left`).toBeGreaterThanOrEqual(0)
      expect(d.maxX, `drag ${x},${y} right`).toBeLessThanOrEqual(W)
      expect(d.top, `drag ${x},${y} top`).toBeGreaterThanOrEqual(0)
    }
    await page.mouse.up()
    expect(errors()).toEqual([])
  })
}

test('reduced motion: he still stands on the dress-up stage', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dress-up')
  await engineReady(page)
  await expect.poll(async () => (await debug(page)).placement).toBe('stage')
  const panel = (await page.getByRole('region', { name: 'Pick a look' }).boundingBox())!
  expect((await debug(page)).maxX).toBeLessThanOrEqual(panel.x)
})

test('dress-up: swatches name themselves, show their pressed state, and Reset restores his look', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dress-up')
  await engineReady(page)
  const reset = page.getByRole('button', { name: 'Reset' })
  await expect(reset).toBeDisabled()
  const navy = page.getByRole('button', { name: 'Hoodie colour: navy' })
  await expect(navy).toHaveAttribute('aria-pressed', 'false')
  await navy.click()
  await expect(navy).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Hoodie colour: slate grey' })).toHaveAttribute('aria-pressed', 'false')
  await page.getByRole('button', { name: 'Round glasses' }).click()
  await page.getByRole('button', { name: 'Blazer and bow tie' }).click()
  await expect(reset).toBeEnabled()
  await reset.click()
  await expect(page.getByRole('button', { name: 'Hoodie colour: slate grey' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'No glasses' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Hoodie', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await debug(page)).outfit).toBe('hoodie')
  await expect(reset).toBeDisabled()
})

test('dress-up: 40 changes leave the GPU geometry count where it started (swaps free what they replace)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dress-up')
  await engineReady(page)
  await page.waitForTimeout(300)
  const start = (await debug(page)).geometries
  expect(start).toBeGreaterThan(0)
  const names = [
    'Curly top',
    'Hard hat',
    'Hair colour: grey',
    'Detective',
    'Buzz cut',
    'Round glasses',
    'Blazer and bow tie',
    'Skin tone: dark',
  ]
  for (let i = 0; i < 5; i++) for (const n of names) await page.getByRole('button', { name: n, exact: true }).click()
  await page.getByRole('button', { name: 'Reset' }).click()
  await page.waitForTimeout(300)
  expect((await debug(page)).geometries).toBe(start)
})

test('dress-up works when storage throws (privacy mode): defaults, no errors', async ({ page }) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await page.goto('/dress-up')
  await engineReady(page)
  await expect(page.getByRole('button', { name: 'Wavy fringe', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Buzz cut', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Buzz cut', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(errors()).toEqual([])
})

test('garbage in storage falls back to his own look', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aryan:look:v1', '{"base":{"hair":"mohawk"}'))
  await page.goto('/dress-up')
  await engineReady(page)
  await expect(page.getByRole('button', { name: 'Wavy fringe', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect((await debug(page)).outfit).toBe('hoodie')
})

// Short screens (review fix): the stage keeps him large (≥ 180 px tall: S × (BOX.y1 − STAGE_CUT) = S × 5.55),
// the long 404 heading stays within two lines, and he touches no edge.
for (const url of ['/dress-up', '/missing'])
  for (const vp of [
    { width: 568, height: 320 },
    { width: 640, height: 360 },
    { width: 360, height: 640 },
  ])
    test(`${url} at ${vp.width}×${vp.height}: he stays ≥ 180 px tall, on screen, heading ≤ 2 lines`, async ({
      page,
    }) => {
      const errors = trackErrors(page)
      await page.setViewportSize(vp)
      await page.goto(url)
      await engineReady(page)
      await expect.poll(async () => (await debug(page)).placement).toBe('stage')
      await idle(page)
      await page.waitForTimeout(300)
      const d = await debug(page)
      expect(d.S * 5.55, `figure height (S = ${d.S.toFixed(1)})`).toBeGreaterThanOrEqual(180)
      const h1 = page.getByRole('heading', { level: 1 })
      const lines = await h1.evaluate(
        (el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
      )
      expect(lines).toBeLessThanOrEqual(2.2)
      // the figure starts below the heading
      const hb = (await h1.boundingBox())!
      expect(d.top).toBeGreaterThanOrEqual(hb.y + hb.height)
      // the "Play with me" pill stays on his stage, off the controls
      const pill = (await page.getByRole('button', { name: 'Play with me' }).boundingBox())!
      const panel = (await page.getByRole('region', { name: 'Pick a look' }).boundingBox())!
      const apart = pill.x + pill.width <= panel.x + 0.5 || pill.y + pill.height <= panel.y + 0.5
      expect(apart, 'pill clear of the controls').toBe(true)
      const W = await page.evaluate(() => document.documentElement.clientWidth)
      await page.evaluate(() => (window as EngineWindow).__engine!.play('panic'))
      for (let i = 0; i < 10; i++) {
        const f = await debug(page)
        expect(f.minX).toBeGreaterThanOrEqual(0)
        expect(f.maxX).toBeLessThanOrEqual(W)
        expect(f.top).toBeGreaterThanOrEqual(0)
        await page.waitForTimeout(150)
      }
      expect(errors().filter((e) => !e.includes('404'))).toEqual([])
    })
