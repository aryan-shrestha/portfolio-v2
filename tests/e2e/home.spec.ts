import { expect, test, type Page } from '@playwright/test'
import { chapters } from '../../content/chapters'

const PLACES = ['hero', 'left', 'left', 'right', 'left', 'badge', 'outro']
const TITLES = ['Napa Valley Weddings', 'Bevlytics', 'Data to Insights']
const strip = (html: string) => html.replace(/<[^>]+>/g, '')

/** Console errors and page errors. */
function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return () => errors
}

/** Wait two frames so the rAF-driven scroll handlers have run. */
const frames = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

test('sections render in order with the engine contract attributes', async ({ page }) => {
  await page.goto('/')
  const sections = page.locator('main > section')
  await expect(sections).toHaveCount(7)
  expect(await sections.evaluateAll((s) => s.map((e) => e.getAttribute('data-place')))).toEqual(PLACES)

  await expect(sections.nth(0)).toHaveAttribute('data-gesture', 'wave')
  await expect(sections.nth(0).getByRole('heading', { level: 1 })).toHaveText('I build the whole thing.')
  await expect(sections.nth(1)).toContainText('now a software engineer at Maitri Services')
  await expect(sections.nth(1)).toContainText('Before that, at Data to Insights AI, I built frontends, APIs and data pipelines')
  for (let c = 0; c < 3; c++) {
    const s = sections.nth(2 + c)
    await expect(s).toHaveAttribute('data-outfit', chapters[c].outfit)
    await expect(s.getByRole('heading', { level: 2 })).toHaveText(TITLES[c])
    await expect(s.getByRole('link', { name: 'View project →' })).toHaveAttribute('href', `/work/${chapters[c].slug}`)
  }
  // All work is not on the page for now (owner); Experience follows the last chapter
  await expect(page.locator('#work')).toHaveCount(0)
  await expect(sections.nth(5)).toHaveAttribute('id', 'experience')
  await expect(sections.nth(6)).toHaveAttribute('id', 'contact')
  await expect(sections.nth(6)).toHaveAttribute('data-gesture', 'wave')
  await expect(sections.nth(6).getByRole('heading', { level: 2 })).toHaveText('Got a project?')
})

test('Experience lists the roles newest first, links the case studies and every credential', async ({ page }) => {
  await page.goto('/')
  const s = page.locator('main > section').nth(5)
  await expect(s).toHaveAttribute('id', 'experience')
  await expect(s).toHaveAttribute('data-place', 'badge')
  await expect(s).toHaveAttribute('data-gesture', 'thumbs')
  // plain paper, no grid: the grid made the small text hard to read
  await expect(s).toHaveCSS('background-image', 'none')
  await expect(s).toHaveCSS('background-color', 'rgb(246, 244, 238)')
  await expect(s.getByRole('heading', { level: 2 })).toHaveText(['Experience', 'Licenses & certifications'])

  const roles = s.locator('ol > li')
  await expect(roles).toHaveCount(5)
  await expect(roles.first().getByRole('heading', { level: 3 })).toHaveText('Maitri Services')
  // no job titles on the site (owner's call; they stay in content/experience.ts)
  await expect(s).not.toContainText(/Software Engineer|Python Developer|Django Developer/)
  await expect(roles.first()).toContainText('Oct 2026 – Present')
  await expect(roles.first().getByRole('list', { name: 'Skills' }).getByRole('listitem')).toHaveText([
    'Python',
    'FastAPI',
    'Browser Automation',
    'TypeScript',
    'React',
    'GCP',
  ])
  await expect(roles.nth(1).getByRole('heading', { level: 3 })).toHaveText('Data to Insights AI')
  await expect(roles.nth(1).getByRole('list', { name: 'Skills' }).getByRole('listitem')).toHaveText([
    'Python',
    'FastAPI',
    'TypeScript',
    'Next.js',
    'NestJS',
    'PostgreSQL',
    'AWS',
  ])
  // no "Built here" line: the rows hold no links (owner removed it)
  await expect(s.locator('ol').getByRole('link')).toHaveCount(0)
  await expect(s).not.toContainText('Built here')
  await expect(s).not.toContainText(/roles since/) // the counter by the heading is gone (owner)

  const creds = s.getByRole('link', { name: /^Show credential/ })
  await expect(creds).toHaveCount(4)
  for (let i = 0; i < 4; i++) {
    await expect(creds.nth(i)).toHaveAttribute('target', '_blank')
    await expect(creds.nth(i)).toHaveAttribute('rel', 'noopener')
    await expect(creds.nth(i)).toHaveAttribute('href', /^https:\/\//)
  }
})

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
])
  test(`Experience at ${vp.width}×${vp.height}: no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(vp)
    await page.goto('/')
    await page.locator('#experience').scrollIntoViewIfNeeded()
    const over = await page.evaluate(() => {
      const W = document.documentElement.clientWidth
      return [...document.querySelectorAll<HTMLElement>('#experience *')]
        .filter((e) => e.getBoundingClientRect().right > W + 0.5)
        .map((e) => e.tagName + ' ' + e.textContent!.slice(0, 40))
    })
    expect(over).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(vp.width)
  })

test('each chapter shows its three narration lines', async ({ page }) => {
  await page.goto('/')
  const sections = page.locator('main > section')
  for (let c = 0; c < 3; c++) {
    const lines = sections.nth(2 + c).locator('.line')
    await expect(lines).toHaveCount(3)
    for (let i = 0; i < 3; i++) {
      await expect(lines.nth(i)).toHaveAttribute('data-line', String(i))
      await expect(lines.nth(i)).toHaveAttribute('data-gesture', chapters[c].lines[i].gesture)
      await expect(lines.nth(i)).toHaveText(strip(chapters[c].lines[i].html))
    }
  }
})

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`scrolling the chapters at ${vp.width}×${vp.height}: never more than one line on, every line activates`, async ({
    page,
  }) => {
    const errors = trackErrors(page)
    await page.setViewportSize(vp)
    await page.goto('/')
    await page.evaluate(() => {
      const w = window as unknown as { __gestures: string[] }
      w.__gestures = []
      window.addEventListener('narration:line', (e) =>
        w.__gestures.push((e as CustomEvent<{ gesture: string }>).detail.gesture),
      )
    })
    const [start, end] = await page.evaluate(() => {
      const s = [...document.querySelectorAll('main > section')]
      return [(s[2] as HTMLElement).offsetTop - innerHeight, (s[5] as HTMLElement).offsetTop]
    })
    const seen = new Set<string>()
    for (let y = start; y <= end; y += Math.round(vp.height / 12)) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      await frames(page)
      const on = await page.evaluate(() =>
        [...document.querySelectorAll('.line.on')].map(
          (l) => `${[...document.querySelectorAll('main > section')].indexOf(l.closest('section')!)}:${(l as HTMLElement).dataset.line}`,
        ),
      )
      expect(on.length, `at scrollY ${y}`).toBeLessThanOrEqual(1)
      on.forEach((k) => seen.add(k))
    }
    expect([...seen].sort()).toEqual(['2:0', '2:1', '2:2', '3:0', '3:1', '3:2', '4:0', '4:1', '4:2'])
    const gestures = await page.evaluate(() => (window as unknown as { __gestures: string[] }).__gestures)
    expect(gestures).toEqual(chapters.flatMap((c) => c.lines.map((l) => l.gesture)))
    expect(errors()).toEqual([])
  })
}

test('activating a line dissolves the browser frame to its screen', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  const napa = page.locator('main > section').nth(2)
  const shown = napa.locator('[data-slide][data-state="shown"]')
  const first = chapters[0].lines[0].screen
  if (first.kind !== 'image') throw new Error('Napa line 0 should show a screenshot')
  await expect(shown.getByRole('img')).toHaveAttribute('alt', first.alt)

  // Bring line 1 (the Next.js / FastAPI line) into the activation band.
  await napa.locator('.line[data-line="1"]').evaluate((l) => {
    window.scrollBy(0, l.getBoundingClientRect().top - innerHeight * 0.2)
  })
  await expect(napa.locator('.line[data-line="1"]')).toHaveClass(/\bon\b/)
  await expect(shown).toHaveCount(1, { timeout: 2000 })
  await expect(shown.getByRole('img', { name: /Next\.js.*FastAPI/ })).toBeVisible()
})

test('clicking the email copies it and announces it', async ({ page, context }) => {
  const errors = trackErrors(page)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.evaluate(() => {
    const w = window as unknown as { __copied: number }
    w.__copied = 0
    window.addEventListener('email:copied', () => w.__copied++)
  })
  const contact = page.locator('#contact')
  await contact.scrollIntoViewIfNeeded()
  await contact.getByRole('button', { name: 'aryanshrestha274@gmail.com' }).click()
  await expect(contact.getByText('Copied! Talk soon.')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('aryanshrestha274@gmail.com')
  expect(await page.evaluate(() => (window as unknown as { __copied: number }).__copied)).toBe(1)
  expect(errors()).toEqual([])
})

test('no horizontal scroll at 360 px and no console errors over the whole page', async ({ page }) => {
  const errors = trackErrors(page)
  await page.setViewportSize({ width: 360, height: 640 })
  await page.goto('/')
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  for (let y = 0; y <= height; y += 320) {
    await page.evaluate((top) => window.scrollTo(0, top), y)
    await frames(page)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
  expect(errors()).toEqual([])
})

test('reduced motion: every About word is on', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  const opacities = await page
    .locator('.about-word')
    .evaluateAll((ws) => ws.map((w) => getComputedStyle(w).opacity))
  expect(opacities.length).toBeGreaterThan(30)
  expect(new Set(opacities)).toEqual(new Set(['1']))
})

for (const vp of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`reduced motion at ${vp.width}×${vp.height}: every narration bubble shows as a plain block, clear of the title`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize(vp)
    await page.goto('/')
    const sections = page.locator('main > section')
    for (let c = 0; c < 3; c++) {
      const section = sections.nth(2 + c)
      const bubbles = section.locator('.line .bubble')
      await expect(bubbles).toHaveCount(3)
      const styles = await bubbles.evaluateAll((bs) =>
        bs.map((b) => {
          const s = getComputedStyle(b)
          return `${s.opacity}|${s.position}`
        }),
      )
      // not sticky (relative only anchors the tail)
      expect(styles).toEqual(['1|relative', '1|relative', '1|relative'])

      // Walk through the chapter: no bubble may ever overlap the chapter title.
      const [top, height] = await section.evaluate((s) => [(s as HTMLElement).offsetTop, (s as HTMLElement).offsetHeight])
      for (let y = top - vp.height; y <= top + height; y += Math.round(vp.height / 10)) {
        await page.evaluate((t) => window.scrollTo(0, t), y)
        await frames(page)
        const overlaps = await section.evaluate((s) => {
          const h = s.querySelector('h2')!.getBoundingClientRect()
          return [...s.querySelectorAll('.line .bubble')].filter((b) => {
            const r = b.getBoundingClientRect()
            return r.left < h.right && r.right > h.left && r.top < h.bottom && r.bottom > h.top
          }).length
        })
        expect(overlaps, `chapter ${c} at scrollY ${y}`).toBe(0)
      }
      for (let i = 0; i < 3; i++) {
        await bubbles.nth(i).scrollIntoViewIfNeeded()
        await expect(bubbles.nth(i)).toBeVisible()
      }
    }
  })
}
