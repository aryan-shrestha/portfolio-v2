import { expect, test, type Page } from '@playwright/test'

type Debug = { placement: string; S: number }
type EngineWindow = Window & { __engine?: { debugState(): Debug }; __marker?: number }

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return () => errors
}

const engineReady = (page: Page) =>
  page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 4000 })
const placement = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugState().placement)

/** The placement of the section the scroll position is in (spec §6.1: p > 0.5 into section k). */
const placementInView = (page: Page) =>
  page.evaluate(() => {
    const H = innerHeight
    const secs = [...document.querySelectorAll<HTMLElement>('[data-place]')].filter((s) => s.getClientRects().length)
    let cur = 0
    secs.forEach((s, k) => {
      const top = s.getBoundingClientRect().top + scrollY
      if (k > 0 && (scrollY + 0.95 * H - top) / (0.75 * H) > 0.5) cur = k
    })
    return secs[cur].dataset.place
  })

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('home → case page → back keeps one character, no reload, right placement, no errors', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await engineReady(page)
  await page.evaluate(() => ((window as EngineWindow).__marker = 1))

  await page.getByRole('link', { name: 'View project →' }).first().click()
  await expect(page).toHaveURL(/\/work\/napa-valley-weddings$/)
  await expect.poll(() => placement(page)).toBe('right')
  await expect(page.locator('[data-char="bubble"]')).toHaveCSS('opacity', '1')

  await page.goBack()
  await expect(page).toHaveURL(/:3100\/$/)
  await expect(page.locator('main > section')).toHaveCount(7)
  expect(await page.evaluate(() => (window as EngineWindow).__marker)).toBe(1) // client-side, no reload
  expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(1)
  await expect.poll(async () => (await placement(page)) === (await placementInView(page))).toBe(true)

  // and it keeps tracking the page it came back to
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => placement(page)).toBe('hero')
  expect(errors()).toEqual([])
})

test('case page: he comments, then shrinks to the badge on the first scroll', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/work/bevlytics')
  await engineReady(page)
  const bubble = page.locator('[data-char="bubble"]')
  await expect(bubble).toHaveText('The data had opinions.')
  await expect.poll(() => placement(page)).toBe('right')
  await page.waitForTimeout(400)
  await page.mouse.wheel(0, 400)
  await expect.poll(() => placement(page)).toBe('badge')
  await expect(bubble).toHaveCSS('opacity', '0')
  await expect.poll(() => page.locator('[data-char="badge"]').evaluate((b) => getComputedStyle(b).opacity)).toBe('1')
  // the handle shrinks to the badge
  const h = (await page.locator('[data-char="handle"]').boundingBox())!
  expect(h.width).toBeLessThanOrEqual(160)
  expect(h.height).toBeLessThanOrEqual(160)
  expect(errors()).toEqual([])
})

test('case page: once he is the badge, Tab reaches "Play with me" on the badge and it opens the menu', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/work/bevlytics')
  await engineReady(page)
  await expect.poll(() => placement(page), { timeout: 6000 }).toBe('badge')
  await expect.poll(() => page.locator('[data-char="badge"]').evaluate((b) => getComputedStyle(b).opacity)).toBe('1')
  const play = page.getByRole('button', { name: 'Play with me' })
  let reached = false
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press('Tab')
    reached = await play.evaluate((el) => el === document.activeElement)
  }
  expect(reached, 'Tab reaches the control').toBe(true)
  // it sits exactly on the badge disc (never over the case text) and shows a focus ring
  const disc = (await page.locator('[data-char="badge"]').boundingBox())!
  const stop = (await play.boundingBox())!
  for (const k of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(stop[k] - disc[k]), k).toBeLessThanOrEqual(1)
  expect(await play.evaluate((el) => getComputedStyle(el).outlineStyle)).toBe('solid')
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Make me do a thing' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(play).toBeFocused()
  expect(errors()).toEqual([])
})

test('case page: without scrolling he becomes the badge after 4 s; the next case page starts over', async ({ page }) => {
  await page.goto('/work/napa-valley-weddings')
  await engineReady(page)
  await expect.poll(() => placement(page)).toBe('right')
  await page.waitForTimeout(3000)
  expect(await placement(page)).toBe('right')
  await expect.poll(() => placement(page), { timeout: 3000 }).toBe('badge')

  await page.getByRole('link', { name: 'Next project →' }).click()
  await expect(page).toHaveURL(/\/work\/bevlytics$/)
  await expect.poll(() => placement(page)).toBe('right')
  await expect(page.locator('[data-char="bubble"]')).toHaveText('The data had opinions.')
})
