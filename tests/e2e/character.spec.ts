import { expect, test, type Page } from '@playwright/test'

type Debug = {
  minX: number
  maxX: number
  top: number
  S: number
  placement: string
  outfit: string
  action: string | null
}
type EngineWindow = Window & { __engine?: { debugState(): Debug } }

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return () => errors
}

const engineReady = (page: Page, timeout = 4000) =>
  page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout })
const debug = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugState())

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('the engine loads and draws into the one canvas within 4 s', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await engineReady(page)
  await expect(page.locator('canvas')).toHaveCount(1)
  // The renderer sized the drawing buffer to the dither grid (W / 3 px per dot).
  expect(await page.locator('canvas').evaluate((c: HTMLCanvasElement) => c.width === Math.ceil(document.documentElement.clientWidth / 3))).toBe(
    true,
  )
  expect(await page.locator('canvas').getAttribute('aria-hidden')).toBe('true')
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--char-s'))).toMatch(/px$/)
  expect(errors()).toEqual([])
})

test('hero bubble greets; at the contact section it says hi', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  const bubble = page.locator('[data-char="bubble"]')
  await expect(bubble).toHaveText("Hi, I'm Aryan. Scroll down and I'll show you around.")
  await expect(bubble.locator('b')).toHaveText('Aryan')
  await expect(bubble).toHaveCSS('opacity', '1')

  await page.evaluate(() => document.getElementById('contact')!.scrollIntoView())
  await expect(bubble).toHaveText('Got something to build? Say hi.')
  await expect(bubble.locator('b')).toHaveText('Say hi.')
  await expect(bubble).toHaveCSS('opacity', '1')
  await expect.poll(async () => (await debug(page)).placement).toBe('outro')
})

test('in the chapters the bubble hides and the outfit follows the chapter', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  const bubble = page.locator('[data-char="bubble"]')
  await page.evaluate(() => {
    const s = document.querySelectorAll<HTMLElement>('main > section')[3] // Bevlytics, right
    window.scrollTo(0, s.offsetTop)
  })
  await expect.poll(async () => (await debug(page)).placement).toBe('right')
  expect((await debug(page)).outfit).toBe('hardhat')
  await expect(bubble).toHaveCSS('opacity', '0')
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(async () => (await debug(page)).outfit).toBe('hoodie')
})

test('dragging him 300 px left and letting go springs him back', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  // let the load wave finish so the rest pose is measured
  await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null, null, {
    timeout: 6000,
  })
  await page.waitForTimeout(800) // the arm settles back to rest
  const before = (await debug(page)).minX
  const box = (await page.locator('[data-char="handle"]').boundingBox())!
  expect(box.width).toBeGreaterThan(50)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 300, y, { steps: 12 })
  await expect.poll(async () => (await debug(page)).minX).toBeLessThan(before - 200)
  await page.mouse.up()
  await page.waitForTimeout(1500)
  expect(Math.abs((await debug(page)).minX - before)).toBeLessThanOrEqual(2)
})

test('a click without drag pokes him (he waves)', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null, null, {
    timeout: 6000,
  })
  await page.locator('[data-char="handle"]').click()
  await expect.poll(async () => (await debug(page)).action).toBe('wave')
})

test('narration lines and the copied email reach him', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('narration:line', { detail: { gesture: 'point' } })),
  )
  await expect.poll(async () => (await debug(page)).action).toBe('point')
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('email:copied')))
  await expect(page.locator('[data-char="bubble"]')).toHaveText('Copied! Talk soon.')
})

test('reduced motion: no automatic gestures and no scroll choreography', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await engineReady(page)
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('narration:line', { detail: { gesture: 'point' } })),
  )
  await page.evaluate(() => {
    const s = document.querySelectorAll<HTMLElement>('main > section')[3]
    window.scrollTo(0, s.offsetTop)
  })
  await page.waitForTimeout(300)
  const d = await debug(page)
  expect(d.action).toBeNull()
  expect(d.placement).toBe('hero')
})
