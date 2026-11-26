import { expect, test, type Page } from '@playwright/test'

const PROJECTS = [
  {
    slug: 'napa-valley-weddings',
    title: 'Napa Valley Weddings',
    year: '2025',
    myPart: 'The whole product, frontend and backend',
    stack: ['Next.js', 'Python', 'FastAPI'],
    live: 'https://www.napavalleyweddings.com/',
    host: 'napavalleyweddings.com',
    diagram: /Next\.js front end/,
    images: [] as string[],
    next: 'bevlytics',
  },
  {
    slug: 'bevlytics',
    title: 'Bevlytics',
    year: '2025',
    myPart: 'ETL pipeline on AWS Lambda loading Snowflake; CloudWatch log monitoring',
    stack: ['Python', 'AWS Lambda', 'Snowflake', 'CloudWatch'],
    live: 'https://www.bevlytics.ai/',
    host: 'bevlytics.ai',
    diagram: /ETL job on AWS Lambda/,
    images: [] as string[],
    next: 'data-to-insights',
  },
  {
    slug: 'data-to-insights',
    title: 'Data to Insights',
    year: '2026',
    myPart: 'Frontend and backend features',
    stack: ['React', 'Zod', 'TanStack', 'shadcn/ui', 'NestJS', 'TypeORM', 'PostgreSQL', 'AWS SDK'],
    live: 'https://www.datatoinsights.ai/',
    host: 'datatoinsights.ai',
    diagram: /React front end calls a NestJS back end/,
    images: ['dti-actions', 'dti-chat'],
    next: 'napa-valley-weddings',
  },
]

function trackErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

for (const p of PROJECTS) {
  test(`${p.slug}: facts, structure and engine contract`, async ({ page }) => {
    const errors = trackErrors(page)
    const res = await page.goto(`/work/${p.slug}`)
    expect(res?.status()).toBe(200)

    const root = page.locator('main > section')
    await expect(root).toHaveCount(1)
    await expect(root).toHaveAttribute('data-place', 'right')
    await expect(root).toHaveAttribute('data-case-comment', p.slug)

    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title)
    await expect(page.getByRole('link', { name: '← Home' })).toHaveAttribute('href', '/')
    const meta = page.getByRole('list', { name: 'Project facts' })
    await expect(meta).toContainText(p.year)
    await expect(meta).toContainText('Built at Data to Insights AI')
    await expect(meta).toContainText(p.myPart)

    await expect(page.getByRole('list', { name: 'Stack' }).getByRole('listitem')).toHaveText(p.stack)

    const live = page.getByRole('link', { name: /Live link/ })
    await expect(live).toHaveAttribute('href', p.live)
    await expect(live).toHaveAttribute('target', '_blank')
    await expect(live).toHaveAttribute('rel', /\bnoopener\b/)

    await expect(page.getByText(p.host, { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'The problem' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: 'What I built' })).toBeVisible()

    if (p.diagram) await expect(page.getByRole('img', { name: p.diagram })).toBeVisible()
    else await expect(page.locator('svg[role="img"]')).toHaveCount(0)

    const more = page.getByRole('region', { name: 'More images' })
    if (p.images.length === 0) {
      await expect(more).toHaveCount(0)
    } else {
      await expect(more.locator('img')).toHaveCount(p.images.length)
      for (const name of p.images) {
        await expect(more.locator(`img[src*="${name}"]`)).toHaveCount(1)
      }
    }

    expect(await page.locator('body').innerText()).not.toMatch(/outcomes/i)
    expect(errors).toEqual([])
  })
}

test('"Next project →" cycles Napa → Bevlytics → DTI → Napa', async ({ page }) => {
  await page.goto(`/work/${PROJECTS[0].slug}`)
  for (const p of [PROJECTS[1], PROJECTS[2], PROJECTS[0]]) {
    await page.getByRole('link', { name: 'Next project →' }).click()
    await expect(page).toHaveURL(new RegExp(`/work/${p.slug}$`))
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(p.title)
  }
})

test('an unknown slug is a 404', async ({ page }) => {
  const res = await page.goto('/work/not-a-project')
  expect(res?.status()).toBe(404)
})

test('"← Home" goes back to the top of the home page', async ({ page }) => {
  await page.goto('/work/bevlytics')
  await page.getByRole('link', { name: '← Home' }).click()
  await expect(page).toHaveURL(/:3100\/$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

for (const [width, height] of [
  [1440, 900],
  [360, 640],
]) {
  test(`no horizontal scroll at ${width}px; desktop keeps a right gutter for the character`, async ({ page }) => {
    await page.setViewportSize({ width, height })
    for (const p of PROJECTS) {
      await page.goto(`/work/${p.slug}`)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      const gutter = await page.evaluate(() => {
        const h = document.querySelector('h1')!.getBoundingClientRect()
        const next = document.querySelector('a[href^="/work/"]')!.getBoundingClientRect()
        return Math.max(h.right, next.right)
      })
      if (width > 900) expect(gutter).toBeLessThanOrEqual(width - 100 * 0.85 * 3.5 + 1)
    }
  })
}
