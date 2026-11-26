import { expect, test, type Page } from '@playwright/test'

/**
 * Idle routines (v1.2, engine/idle.ts). Timings are 20 s / 15–30 s / 60 s / 15 s in real use; the
 * tests run them at 1/50 (debugIdle(0.02)): first emote 0.4 s, sleep at 1.2 s, welcome after 0.3 s away.
 */
type DebugState = { action: string | null; asleep: boolean; placement: string }
type EngineWindow = Window & { __engine?: { debugState(): DebugState; debugIdle(scale: number): void } }

const EMOTES = ['think', 'thumbs', 'hiccup', 'sneeze', 'peekaboo', 'wave']
const engineReady = (page: Page) =>
  page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 8000 })
const debug = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugState())
const fast = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugIdle(0.02))
const bubble = (page: Page) => page.locator('[data-char="bubble"]')
const setHidden = (page: Page, hidden: boolean) =>
  page.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h })
    document.dispatchEvent(new Event('visibilitychange'))
  }, hidden)

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('left alone, he plays idle emotes, then yawns and falls asleep with a "Zzz"', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null)
  await fast(page)
  // an emote from the gentle set
  await expect.poll(async () => EMOTES.includes((await debug(page)).action ?? ''), { timeout: 3000 }).toBe(true)
  // then the doze: yawn, then sleep
  await expect.poll(async () => (await debug(page)).asleep, { timeout: 4000 }).toBe(true)
  await expect.poll(async () => (await debug(page)).action, { timeout: 5000 }).toBe('sleep')
  await expect(bubble(page)).toHaveText('Zzz…')
  await expect(bubble(page)).toHaveCSS('opacity', '1')
})

test('any input wakes him: a startled hop and "I\'m up! I\'m up."', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await fast(page)
  await expect.poll(async () => (await debug(page)).action, { timeout: 8000 }).toBe('sleep')
  await page.mouse.move(300, 300)
  await expect.poll(async () => (await debug(page)).action).toBe('wake')
  expect((await debug(page)).asleep).toBe(false)
  await expect(bubble(page)).toHaveText("I'm up! I'm up.")
})

test('back on the tab after a while: he waves "Oh, you\'re back!"; a quick switch does nothing', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null)
  await page.evaluate(() => (window as EngineWindow).__engine!.debugIdle(0.5)) // away threshold 7.5 s
  await setHidden(page, true)
  await page.waitForTimeout(300)
  await setHidden(page, false)
  await page.waitForTimeout(300)
  expect((await debug(page)).action).toBeNull() // too short a switch

  await fast(page) // away threshold 0.3 s
  await setHidden(page, true)
  await page.waitForTimeout(600)
  await setHidden(page, false)
  await expect.poll(async () => (await debug(page)).action).toBe('wave')
  await expect(bubble(page)).toHaveText("Oh, you're back!")
})

test('no idle routines while the action menu is open', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await page.getByRole('button', { name: 'Play with me' }).click()
  await expect(page.getByRole('menu', { name: 'Make me do a thing' })).toBeVisible()
  await page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null)
  await fast(page)
  const seen = new Set<string>()
  for (let i = 0; i < 20; i++) {
    const d = await debug(page)
    if (d.action) seen.add(d.action)
    if (d.asleep) seen.add('asleep')
    await page.waitForTimeout(100)
  }
  expect([...seen]).toEqual([])
})

test('reduced motion: no idle routines', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await engineReady(page)
  await fast(page)
  await page.waitForTimeout(2000)
  const d = await debug(page)
  expect(d.action).toBeNull()
  expect(d.asleep).toBe(false)
})
