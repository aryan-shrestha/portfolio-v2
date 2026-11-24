import { expect, test, type Locator, type Page } from '@playwright/test'

/**
 * Fallbacks (spec §7.3, §7.7, §7.8): reduced motion, no WebGL, the returning visitor and the
 * 900 px crossing. `view` says how he is shown now: 'live' (animated canvas), 'image' (still.png),
 * 'frame' (one still canvas frame: a chosen action, or the dress-up stage) or 'hidden'.
 */
type Debug = {
  minX: number
  maxX: number
  top: number
  placement: string
  action: string | null
  view: 'live' | 'image' | 'frame' | 'hidden'
}
type EngineWindow = Window & { __engine?: { debugState(): Debug; play(a: string): void } }

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return () => errors
}
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
/** Scrolls to the middle of the range where section i is the one in view (p > 0.5 into it, not yet into the next). */
const scrollToSection = (page: Page, i: number) =>
  page.evaluate((i) => {
    const s = document.querySelectorAll<HTMLElement>('main > section')[i]
    window.scrollTo(0, Math.max(0, s.offsetTop - 0.575 * innerHeight + 0.5 * s.offsetHeight))
  }, i)
const still = (page: Page) => page.locator('img[data-char="still"]')
/** The still is drawn (decoded, laid out, not hidden) and is the committed PNG. */
async function expectStillShown(img: Locator) {
  await expect(img).toBeVisible()
  await expect(img).toHaveAttribute('src', /\/character\/still\.png$/)
  await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(600)
}
/** Two screenshots of him alone (the page hidden), `ms` apart, are identical: nothing of him moves. */
async function staysStill(page: Page, ms = 600) {
  await page.addStyleTag({
    content:
      'html, body { background: #808080 !important; } body > *:not([data-char="canvas"]):not([data-char="still"]) { visibility: hidden !important; }',
  })
  const a = await page.screenshot({ animations: 'allow' })
  await page.waitForTimeout(ms)
  const b = await page.screenshot({ animations: 'allow' })
  await page.evaluate(() => document.head.lastElementChild?.remove())
  expect(Buffer.compare(a, b), 'he changed between the two shots: something moved').toBe(0)
}
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

test.describe.configure({ mode: 'parallel' })

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const vp of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ])
    test(`${vp.width}×${vp.height}: still.png in the hero and as the badge; scrolling never moves him`, async ({ page }) => {
      const errors = trackErrors(page)
      await page.setViewportSize(vp)
      await page.goto('/')
      await engineReady(page)
      const img = still(page)
      await expectStillShown(img)
      expect((await debug(page)).view).toBe('image')
      // he greets from the hero, as a plain bubble
      await expect(page.locator('[data-char="bubble"]')).toHaveText(/Hi, I'm Aryan/)
      const at0 = (await img.boundingBox())!
      // the still stands where the hero placement puts him, clear of the hero copy
      const copy = (await page.locator('section[data-place="hero"] [data-copy]').boundingBox())!
      const d = await debug(page)
      expect(d.minX).toBeGreaterThanOrEqual(0)
      expect(d.maxX).toBeLessThanOrEqual(vp.width)
      if (vp.width <= 900) expect(d.top).toBeGreaterThanOrEqual(copy.y + copy.height)

      // scrolling inside the hero: no choreography, he does not move
      await page.evaluate(() => window.scrollTo(0, Math.round(innerHeight * 0.3)))
      await frames(page)
      expect(await img.boundingBox()).toEqual(at0)
      await staysStill(page, 300)

      // About and the chapters: no still over the reading text
      for (const i of [1, 2, 3, 4]) {
        await scrollToSection(page, i)
        await expect.poll(async () => (await debug(page)).view).toBe('hidden')
        await expect(img).toBeHidden()
        await expect(page.locator('[data-char="bubble"]')).toHaveCSS('opacity', '0')
      }
      // narration reads as text
      await expect(page.locator('main > section').nth(2).locator('.line .bubble').first()).toBeVisible()

      // All work: the badge, with still.png inside its circle
      await scrollToSection(page, 5)
      await expect.poll(async () => (await debug(page)).placement).toBe('badge')
      await expectStillShown(img)
      const badge = (await page.locator('[data-char="badge"]').boundingBox())!
      expect(badge.width).toBe(vp.width > 900 ? 160 : 112)
      expect(await page.locator('[data-char="badge"]').evaluate((b) => getComputedStyle(b).opacity)).toBe('1')
      expect(await img.evaluate((i) => getComputedStyle(i).clipPath)).toMatch(/^circle/)
      // no "Play with me" at the badge (a poke on the badge opens the menu)
      await expect(page.getByRole('button', { name: 'Play with me' })).toBeHidden()

      // Contact: the outro still
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await expect.poll(async () => (await debug(page)).placement).toBe('outro')
      await expectStillShown(img)
      expect(await img.evaluate((i) => getComputedStyle(i).clipPath)).toBe('none')
      expect((await debug(page)).action).toBeNull() // no automatic wave on arrival
      expect(errors()).toEqual([])
    })

  test('a chosen action shows as one held still pose, then the still image returns', async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await engineReady(page)
    await expectStillShown(still(page))
    // narration gestures never play by themselves
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('narration:line', { detail: { gesture: 'point' } })))
    await frames(page)
    expect((await debug(page)).action).toBeNull()

    await page.getByRole('button', { name: 'Play with me' }).click()
    await page.getByRole('menuitem', { name: 'Dance' }).click()
    await expect.poll(async () => (await debug(page)).view).toBe('frame')
    expect((await debug(page)).action).toBe('dance')
    await expect(still(page)).toBeHidden()
    await expect(page.locator('[data-char="bubble"]')).toHaveText('Tests passed. Dance break.')
    await staysStill(page, 500) // one pose, not an animation
    // after the action's duration (4 s) the still image is back
    await expect.poll(async () => (await debug(page)).view, { timeout: 6000 }).toBe('image')
    await expectStillShown(still(page))
    expect(errors()).toEqual([])
  })

  test('dragging does not carry him: a press only pokes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await engineReady(page)
    await expectStillShown(still(page))
    const before = await debug(page)
    const box = (await page.locator('[data-char="handle"]').boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x - 200, box.y + 40, { steps: 8 })
    await frames(page)
    const during = await debug(page)
    expect(during.minX).toBe(before.minX)
    expect(during.view).toBe('image')
    await page.mouse.up()
  })

  test('case page: straight to the badge, never over the text', async ({ page }) => {
    const errors = trackErrors(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/work/bevlytics')
    await engineReady(page)
    await expect.poll(async () => (await debug(page)).placement).toBe('badge')
    await expectStillShown(still(page))
    const badge = (await page.locator('[data-char="badge"]').boundingBox())!
    for (const el of await page.locator('main :is(h1, h2, p, li, a)').all()) {
      if (!(await el.isVisible())) continue
      const r = (await el.boundingBox())!
      expect(overlaps(badge, r), `badge covers "${(await el.textContent())?.slice(0, 30)}"`).toBe(false)
    }
    expect(errors()).toEqual([])
  })

  test('dress-up: one still frame on his stage (no idle motion), beside the controls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dress-up')
    await engineReady(page)
    await expect.poll(async () => (await debug(page)).view).toBe('frame')
    expect((await debug(page)).placement).toBe('stage')
    const panel = (await page.getByRole('region', { name: 'Pick a look' }).boundingBox())!
    expect((await debug(page)).maxX).toBeLessThanOrEqual(panel.x)
    await staysStill(page, 600)
    // a look change redraws him once, still
    await page.getByRole('button', { name: 'Hard hat', exact: true }).click()
    await frames(page)
    await staysStill(page, 300)
  })

  // T5 follow-up: on desktop the browser frame stays pinned in view while lines 2–3 swap its screen.
  test('desktop chapters: the screen follows every line while the frame is in view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    for (let c = 0; c < 3; c++) {
      const section = page.locator('main > section').nth(2 + c)
      const [top, height] = await section.evaluate((s) => [(s as HTMLElement).offsetTop, (s as HTMLElement).offsetHeight])
      const seen = new Map<number, number>() // line → slide shown while it was on
      for (let y = top - 900; y <= top + height; y += 30) {
        await page.evaluate((t) => window.scrollTo(0, t), y)
        await frames(page, 2)
        const s = await section.evaluate((sec) => {
          const on = sec.querySelector<HTMLElement>('.line.on')
          const frame = sec.querySelector('[data-slide]')!.parentElement!.getBoundingClientRect()
          const shown = sec.querySelector<HTMLElement>('[data-slide][data-state="shown"]')
          return {
            line: on ? Number(on.dataset.line) : -1,
            slide: shown ? Number(shown.dataset.slide) : -1,
            inView: frame.top >= 0 && frame.bottom <= innerHeight,
          }
        })
        if (s.line >= 0 && s.inView && !seen.has(s.line)) seen.set(s.line, s.slide)
      }
      expect([...seen.keys()].sort(), `chapter ${c}: every line comes on with the frame in view`).toEqual([0, 1, 2])
      const expected = await section.evaluate((sec) => sec.querySelectorAll('[data-slide]').length)
      expect(new Set(seen.values()).size, `chapter ${c}: each distinct screen is shown`).toBe(expected)
    }
  })
})

test.describe('no WebGL', () => {
  // its own browser: WebGL off at launch (a launch option cannot be set per describe without a new worker)
  test('still.png at the hero, the badge and the outro; no interactions; no console errors', async ({
    playwright,
    baseURL,
  }) => {
    const browser = await playwright.chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] })
    const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 900 } })
    try {
      await noWebGL(page)
    } finally {
      await browser.close()
    }
  })
})

async function noWebGL(page: Page) {
  {
    const errors = trackErrors(page)
    await page.goto('/')
    expect(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))).toBe(false)
    await engineReady(page)
    await expectStillShown(still(page))
    expect((await debug(page)).view).toBe('image')
    await expect(page.locator('[data-char="bubble"]')).toHaveText(/Hi, I'm Aryan/)
    // no interactions: no menu, no grab handle
    await expect(page.getByRole('button', { name: 'Play with me' })).toHaveCount(0)
    expect((await page.locator('[data-char="handle"]').boundingBox())?.width ?? 0).toBe(0)
    await scrollToSection(page, 2)
    await expect.poll(async () => (await debug(page)).view).toBe('hidden')
    await scrollToSection(page, 5)
    await expect.poll(async () => (await debug(page)).placement).toBe('badge')
    await expectStillShown(still(page))
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await expect.poll(async () => (await debug(page)).placement).toBe('outro')
    await expectStillShown(still(page))
    // case page and dress-up stay readable, with the still where he would be
    await page.goto('/work/napa-valley-weddings')
    await engineReady(page)
    await expect.poll(async () => (await debug(page)).placement).toBe('badge')
    await expectStillShown(still(page))
    await page.goto('/dress-up')
    await engineReady(page)
    await expect.poll(async () => (await debug(page)).placement).toBe('stage')
    await expectStillShown(still(page))
    const panel = (await page.getByRole('region', { name: 'Pick a look' }).boundingBox())!
    expect(overlaps((await still(page).boundingBox())!, panel)).toBe(false)
    expect(errors()).toEqual([])
  }
}

test('a returning visitor gets the "back" greeting; a first visit the usual one', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await engineReady(page)
  const bubble = page.locator('[data-char="bubble"]')
  await expect(bubble).toHaveText("Hi, I'm Aryan. Scroll down and I'll show you around.")
  await page.reload()
  await engineReady(page)
  await expect(bubble).toHaveText(/you're back/)
  await expect(bubble.locator('b')).toHaveText('back')
})

test('the returning-visitor greeting works without storage (privacy mode): first-visit greeting, no errors', async ({
  page,
}) => {
  const errors = trackErrors(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError')
      },
    })
  })
  await page.goto('/')
  await engineReady(page)
  await expect(page.locator('[data-char="bubble"]')).toHaveText(/Hi, I'm Aryan/)
  await page.reload()
  await engineReady(page)
  await expect(page.locator('[data-char="bubble"]')).toHaveText(/Hi, I'm Aryan/)
  expect(errors()).toEqual([])
})

test('crossing 900 px wide, he says the phone-size quip (once per crossing, not on load)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  await engineReady(page)
  const bubble = page.locator('[data-char="bubble"]')
  await expect(bubble).toHaveText(/Hi, I'm Aryan/)
  await page.setViewportSize({ width: 880, height: 900 })
  await expect(bubble).toHaveText(/phone size/)
  await expect(bubble).toHaveCSS('opacity', '1')
  // loading narrow is not a crossing
  await page.goto('/')
  await engineReady(page)
  await frames(page, 10)
  await expect(bubble).not.toHaveText(/phone size/)
})
