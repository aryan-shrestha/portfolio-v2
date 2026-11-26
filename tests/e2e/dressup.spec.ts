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
  await page.locator('#contact footer').getByRole('link', { name: 'Dress me up' }).click()
  await expect(page).toHaveURL(/\/dress-up$/)
  await expect.poll(async () => (await debug(page)).placement).toBe('stage')
  expect(await page.evaluate(() => (window as EngineWindow).__marker)).toBe(1)
  expect(await page.evaluate(() => document.querySelectorAll('canvas').length)).toBe(1)
})

// v1.2: a "Dress me up" pill beside "Play with me" wherever the pill shows (wide screens: in a row, on
// the far side from him; phones: stacked above it); not as the badge, and not on the dress-up page itself.
for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`"Dress me up" pill beside "Play with me" (${vp.width}×${vp.height}): client navigation, hidden at the badge and on the stage`, async ({
    page,
  }) => {
    await page.setViewportSize(vp)
    await page.goto('/')
    await engineReady(page)
    await idle(page)
    const play = page.getByRole('button', { name: 'Play with me' })
    const dress = page.locator('a.char-play')
    await expect(dress).toBeVisible()
    await expect(dress).toHaveAccessibleName('Dress me up')
    await expect(dress).toHaveAttribute('href', '/dress-up')
    await page.waitForTimeout(500)
    const p = (await play.boundingBox())!
    const d = (await dress.boundingBox())!
    const right = (b: typeof p) => b.x + b.width
    if (vp.width > 900) {
      // a row on the bottom edge: same baseline, a small gap, the far side from him (he is right of it)
      expect(Math.abs(d.y - p.y)).toBeLessThanOrEqual(1)
      expect(p.x - right(d), 'a small gap, on the far side').toBeGreaterThanOrEqual(8)
      expect(p.x - right(d)).toBeLessThanOrEqual(16)
    } else {
      // stacked above it, on the same edge
      expect(d.y + d.height, 'above the pill').toBeLessThanOrEqual(p.y)
      expect(p.y - (d.y + d.height), 'a small gap').toBeLessThanOrEqual(16)
      expect(Math.abs(d.x - p.x) <= 1 || Math.abs(right(d) - right(p)) <= 1).toBe(true)
    }
    // not over him
    const s = await debug(page)
    expect(d.x + d.width <= s.minX || d.x >= s.maxX, `pill ${JSON.stringify(d)} vs ${s.minX}–${s.maxX}`).toBe(true)
    // the menu opens above both pills
    await play.click()
    const menu = (await page.locator('.char-menu').boundingBox())!
    expect(menu.y + menu.height).toBeLessThanOrEqual(d.y + 1)
    await page.keyboard.press('Escape')

    // as the badge: no dress pill
    await page.evaluate(() => document.getElementById('experience')!.scrollIntoView())
    await expect.poll(async () => (await debug(page)).placement).toBe('badge')
    await expect(dress).toBeHidden()
    // back at the hero it returns; a press takes him (the same character) to his stage, where it hides
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(dress).toBeVisible()
    await page.evaluate(() => ((window as EngineWindow).__marker = 1))
    await dress.click()
    await expect(page).toHaveURL(/\/dress-up$/)
    await expect.poll(async () => (await debug(page)).placement).toBe('stage')
    expect(await page.evaluate(() => (window as EngineWindow).__marker)).toBe(1)
    await expect(play).toBeVisible()
    await expect(page.locator('a.char-play')).toBeHidden()
  })
}

// Where the hero text comes close to him (1024×768), "Dress me up" is a round icon button in the row:
// still named "Dress me up", clear of the text.
test('"Dress me up" turns into a round icon button where a pill would cover the hero text (1024×768)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/')
  await engineReady(page)
  await idle(page)
  const dress = page.locator('a.char-play')
  await expect(dress).toHaveClass(/char-dress-compact/)
  await expect(dress).toHaveAccessibleName('Dress me up')
  const d = (await dress.boundingBox())!
  expect(Math.abs(d.width - d.height)).toBeLessThanOrEqual(1)
  const p = (await page.getByRole('button', { name: 'Play with me' }).boundingBox())!
  expect(Math.abs(d.y - p.y)).toBeLessThanOrEqual(1)
  // scrolled on to a chapter, there is room: the full pill again
  await page.evaluate(() => document.querySelectorAll('section')[2].scrollIntoView())
  await expect(dress).not.toHaveClass(/char-dress-compact/)
  await expect(dress).toHaveText('Dress me up')
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
    // centred on the stage area, or (narrow stage) stepped left by up to (16 + PILL_W) / 2 = 70 px so the
    // "Play with me" pill fits beside him (engine/placement `aside`); his top inside it
    const off = stage.x + stage.width / 2 - (rest.minX + rest.maxX) / 2
    expect(Math.min(Math.abs(off), Math.abs(off - 70))).toBeLessThan(0.1 * stage.width)
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

/** Pixels in a box (fractions of his handle box) that lean toward `chan` by at least 25 over the others. */
async function leaning(page: Page, box: { x0: number; y0: number; x1: number; y1: number }, chan: 'r' | 'b' | 'white') {
  const { default: sharp } = await import('sharp')
  const h = (await page.locator('[data-char="handle"]').boundingBox())!
  const clip = {
    x: Math.round(h.x + h.width * box.x0),
    y: Math.round(h.y + h.height * box.y0),
    width: Math.round(h.width * (box.x1 - box.x0)),
    height: Math.round(h.height * (box.y1 - box.y0)),
  }
  const { data, info } = await sharp(await page.screenshot({ clip }))
    .raw()
    .toBuffer({ resolveWithObject: true })
  let n = 0
  for (let i = 0; i < data.length; i += info.channels) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    if (
      chan === 'white'
        ? r > 240 && g > 240 && b > 240
        : chan === 'b'
          ? b > r + 25 && b > g + 10
          : r > b + 25 && r > g + 10
    )
      n++
  }
  return n / (info.width * info.height)
}

test('colour picks show on him: the hoodie and skin swatches change the colour of his dots (v1.2)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/dress-up')
  await engineReady(page)
  await idle(page)
  const torso = { x0: 0.3, y0: 0.72, x1: 0.7, y1: 0.95 }
  const face = { x0: 0.3, y0: 0.25, x1: 0.7, y1: 0.45 }
  // his own grey hoodie: no colour cast
  expect(await leaning(page, torso, 'b')).toBeLessThan(0.02)
  expect(await leaning(page, torso, 'r')).toBeLessThan(0.02)

  await page.getByRole('button', { name: 'Hoodie colour: navy' }).click()
  await expect.poll(() => leaning(page, torso, 'b')).toBeGreaterThan(0.25)
  await page.getByRole('button', { name: 'Hoodie colour: burgundy' }).click()
  await expect.poll(() => leaning(page, torso, 'r')).toBeGreaterThan(0.25)

  // skin: the face is tinted warm, more so for a darker tone
  const light = await leaning(page, face, 'r')
  await page.getByRole('button', { name: 'Skin tone: medium-dark' }).click()
  await expect.poll(() => leaning(page, face, 'r')).toBeGreaterThan(Math.max(0.3, light + 0.1))
  // the rims behind eyes and mouth take the skin's tint: no white halos on dark skin
  await page.getByRole('button', { name: 'Skin tone: dark' }).click()
  await page.getByRole('button', { name: 'Round glasses' }).click()
  await expect.poll(() => leaning(page, face, 'white')).toBeLessThan(0.03)
})
