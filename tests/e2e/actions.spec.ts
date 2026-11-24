import { expect, test, type Locator, type Page } from '@playwright/test'

type Debug = { minX: number; maxX: number; top: number; S: number; placement: string; action: string | null }
type EngineWindow = Window & { __engine?: { debugState(): Debug; play(a: string): void } }

const ACTIONS = ['wave', 'dance', 'panic', 'fly', 'vanish', 'hiccup', 'peekaboo', 'selfie', 'dizzy', 'sneeze', 'sulk', 'deploying']

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return () => errors
}
const engineReady = (page: Page) => page.waitForFunction(() => !!(window as EngineWindow).__engine, null, { timeout: 4000 })
const debug = (page: Page) => page.evaluate(() => (window as EngineWindow).__engine!.debugState())
const idle = (page: Page) =>
  page.waitForFunction(() => (window as EngineWindow).__engine!.debugState().action === null, null, { timeout: 6000 })
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 80; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((el) => el === document.activeElement)) return
  }
  throw new Error('never reached the target with Tab')
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
})

test('poking him (click, no drag) opens the menu with all twelve actions', async ({ page }) => {
  const errors = trackErrors(page)
  await page.goto('/')
  await engineReady(page)
  await idle(page)
  await page.locator('[data-char="handle"]').click()
  const menu = page.getByRole('menu', { name: 'Make me do a thing' })
  await expect(menu).toBeVisible()
  await expect(menu.getByRole('menuitem')).toHaveCount(12)
  await expect(page.locator('[data-char="bubble"]')).toHaveText('Psst. You can grab me.')
  await expect(menu.getByRole('menuitem').first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  expect(errors()).toEqual([])
})

test('a right-click or a second pointer does not poke him (R11)', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await idle(page)
  const handle = page.locator('[data-char="handle"]')
  const dragging = () => page.evaluate(() => document.body.classList.contains('char-dragging'))
  await handle.click({ button: 'right' })
  await page.waitForTimeout(300)
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await dragging()).toBe(false)

  // a second finger: pointerdown/up with isPrimary false
  await handle.evaluate((el) => {
    const init = { isPrimary: false, button: 0, pointerId: 7, pointerType: 'touch', bubbles: true }
    el.dispatchEvent(new PointerEvent('pointerdown', init))
    el.dispatchEvent(new PointerEvent('pointerup', init))
  })
  await page.waitForTimeout(300)
  await expect(page.getByRole('menu')).toHaveCount(0)
  expect(await dragging()).toBe(false)

  // losing pointer capture mid-press ends the drag, and the release is then not a poke
  const box = (await handle.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  expect(await dragging()).toBe(true)
  await handle.evaluate((el) => el.dispatchEvent(new PointerEvent('lostpointercapture', { pointerId: 1, bubbles: true })))
  expect(await dragging()).toBe(false)
  await page.mouse.up()
  await page.waitForTimeout(300)
  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('keyboard: Tab to "Play with me", Enter opens, arrows move, Escape closes and returns focus', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  const play = page.getByRole('button', { name: 'Play with me' })
  await expect(play).toBeVisible()
  await expect(play).toHaveAttribute('aria-expanded', 'false')
  await tabTo(page, play)
  await page.keyboard.press('Enter')
  const menu = page.getByRole('menu', { name: 'Make me do a thing' })
  await expect(menu).toBeVisible()
  await expect(play).toHaveAttribute('aria-expanded', 'true')
  const items = menu.getByRole('menuitem')
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(items.nth(1)).toBeFocused()
  await page.keyboard.press('End')
  await expect(items.last()).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(items.first()).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await expect(play).toBeFocused()
})

test('choosing Dance plays it, closes the menu and he reacts', async ({ page }) => {
  await page.goto('/')
  await engineReady(page)
  await idle(page)
  await page.waitForTimeout(600)
  const before = await debug(page)
  await page.getByRole('button', { name: 'Play with me' }).click()
  await page.getByRole('menuitem', { name: 'Dance' }).click()
  await expect(page.getByRole('menu')).toHaveCount(0)
  await expect.poll(async () => (await debug(page)).action).toBe('dance')
  await expect(page.locator('[data-char="bubble"]')).toHaveText('Tests passed. Dance break.')
  // the silhouette moves over the next second
  const seen = new Set<string>()
  for (let i = 0; i < 10; i++) {
    const d = await debug(page)
    seen.add(`${Math.round(d.minX)}|${Math.round(d.maxX)}|${Math.round(d.top)}`)
    await page.waitForTimeout(100)
  }
  seen.add(`${Math.round(before.minX)}|${Math.round(before.maxX)}|${Math.round(before.top)}`)
  expect(seen.size).toBeGreaterThan(3)
})

test('every action plays and stays inside the window (left, right, top)', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = trackErrors(page)
  await page.goto('/')
  await engineReady(page)
  await idle(page)
  const W = await page.evaluate(() => document.documentElement.clientWidth)
  for (const a of ACTIONS) {
    await page.evaluate((a) => (window as EngineWindow).__engine!.play(a), a)
    await expect.poll(async () => (await debug(page)).action).toBe(a)
    for (let i = 0; i < 14; i++) {
      const d = await debug(page)
      expect(d.minX, `${a} left`).toBeGreaterThanOrEqual(0)
      expect(d.maxX, `${a} right`).toBeLessThanOrEqual(W)
      expect(d.top, `${a} top`).toBeGreaterThanOrEqual(0)
      await page.waitForTimeout(200)
    }
    await idle(page)
  }
  expect(errors()).toEqual([])
})

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`"Play with me" never covers page text (${vp.width}×${vp.height}) and hides at the badge`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto('/')
    await engineReady(page)
    const play = page.getByRole('button', { name: 'Play with me' })
    await expect(play).toBeVisible()
    const clear = async (texts: Locator) => {
      const b = (await play.boundingBox())!
      for (const el of await texts.all()) {
        if (!(await el.isVisible())) continue
        const t = (await el.boundingBox())!
        expect(overlaps(b, t), `covers "${(await el.textContent())?.slice(0, 30)}"`).toBe(false)
      }
    }
    await page.waitForTimeout(500)
    await clear(page.locator('section[data-place="hero"] :is(h1, p, a)'))

    await page.evaluate(() => document.getElementById('contact')!.scrollIntoView())
    await expect.poll(async () => (await debug(page)).placement).toBe('outro')
    await page.waitForTimeout(500)
    await clear(page.locator('#contact :is(h2, p, a, span, button)'))

    // All work: he is the badge, so the button goes away
    await page.evaluate(() => document.getElementById('work')!.scrollIntoView())
    await expect.poll(async () => (await debug(page)).placement).toBe('badge')
    await expect(play).toBeHidden()
  })
}

// R13: on phones no pixel may touch the left, right or top edge, on any frame — the widest poses
// (panic, cheer, dance), taps on the handle (never the carried pose) and a real press-drag.
type Sample = [number, number, number]
type SamplerWindow = EngineWindow & { __samples?: Sample[]; __sampling?: boolean }
const startSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as SamplerWindow
    w.__samples = []
    w.__sampling = true
    const loop = () => {
      if (!w.__sampling) return
      const d = w.__engine!.debugState()
      w.__samples!.push([d.minX, d.maxX, d.top])
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })
const stopSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as SamplerWindow
    w.__sampling = false
    return w.__samples!
  })

for (const vp of [
  { width: 390, height: 844 },
  { width: 360, height: 640 },
]) {
  test(`every frame stays inside the window at ${vp.width}×${vp.height}: wide poses, taps, a drag`, async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize(vp)
    await page.goto('/')
    await engineReady(page)
    await idle(page)
    const W = await page.evaluate(() => document.documentElement.clientWidth)
    const check = (label: string, samples: Sample[]) => {
      expect(samples.length, `${label}: frames sampled`).toBeGreaterThan(10)
      samples.forEach(([minX, maxX, top], i) => {
        expect(minX, `${label} frame ${i} left`).toBeGreaterThanOrEqual(0)
        expect(maxX, `${label} frame ${i} right`).toBeLessThanOrEqual(W)
        expect(top, `${label} frame ${i} top`).toBeGreaterThanOrEqual(0)
      })
    }

    for (const a of ['panic', 'cheer', 'dance'] as const) {
      await startSampling(page)
      await page.evaluate((a) => (window as EngineWindow).__engine!.play(a), a)
      await page.waitForTimeout(a === 'dance' ? 4400 : 3000)
      check(a, await stopSampling(page))
    }

    const handle = page.locator('[data-char="handle"]')
    await startSampling(page)
    for (let i = 0; i < 3; i++) {
      await handle.click()
      await page.waitForTimeout(400)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }
    check('taps', await stopSampling(page))

    const box = (await handle.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await startSampling(page)
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 120, y - 40, { steps: 10 })
    await page.mouse.move(x + 120, y - 40, { steps: 20 })
    await page.mouse.move(x, y, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(1200)
    check('drag', await stopSampling(page))
  })
}

for (const vp of [
  { width: 640, height: 360 },
  { width: 844, height: 390 },
]) {
  test(`short screens (${vp.width}×${vp.height}): every menu item is inside the window and clickable`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto('/')
    await engineReady(page)
    await page.getByRole('button', { name: 'Play with me' }).click()
    const menu = page.getByRole('menu', { name: 'Make me do a thing' })
    await expect(menu).toBeVisible()
    const items = menu.getByRole('menuitem')
    await expect(items).toHaveCount(12)
    // the bubble keeps the 16 px phone edge on every side (layout fit, not a lucky mid-animation rect)
    await page.waitForTimeout(300)
    const r = (await page.locator('.char-menu').boundingBox())!
    expect(r.y).toBeGreaterThanOrEqual(16 - 0.5)
    expect(r.y + r.height).toBeLessThanOrEqual(vp.height - 16 + 0.5)
    expect(r.x).toBeGreaterThanOrEqual(16 - 0.5)
    expect(r.x + r.width).toBeLessThanOrEqual(vp.width - 16 + 0.5)
    for (const item of await items.all()) {
      await expect(item).toBeInViewport({ ratio: 1 })
      await item.click({ trial: true })
    }
    await items.last().click()
    await expect(menu).toBeHidden()
    await expect.poll(async () => (await debug(page)).action).toBe('deploying')
  })
}
