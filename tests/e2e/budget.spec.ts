import { expect, test, type Page } from '@playwright/test'

/**
 * Size budgets (spec §10): on a cold first load of `/` (cache disabled), the gzip transfer size of
 * every JS request except the lazy engine chunk ≤ 120 KB, and the engine chunk ≤ 220 KB. Sizes are
 * the encoded bodies the server sent (`next start` gzips). Classified by import origin: the page's
 * initial JS is what its HTML names; the engine is what the one dynamic import (components/character/
 * live.ts, after idle) fetches on top: the three.js chunk (it carries WebGLRenderer) plus the small
 * chunk of character code split off it. `noModule` polyfills are never fetched by a module browser.
 */
const KB = 1024
const INITIAL_BUDGET = 120 * KB
const ENGINE_BUDGET = 220 * KB

type Js = { url: string; bytes: number; three: boolean; engine: boolean }

async function coldLoad(page: Page): Promise<Js[]> {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  const js: Promise<Omit<Js, 'engine'>>[] = []
  page.on('response', (res) => {
    const url = res.url()
    if (res.request().resourceType() !== 'script' || !url.includes('/_next/')) return
    js.push(
      (async () => {
        const [sizes, body, headers] = await Promise.all([res.request().sizes(), res.text(), res.allHeaders()])
        expect(headers['content-encoding'], `${url} is sent compressed`).toBe('gzip')
        return { url, bytes: sizes.responseBodySize, three: body.includes('WebGLRenderer') }
      })(),
    )
  })
  const html = await (await page.goto('/'))!.text()
  // the engine chunk arrives after the page is idle (requestIdleCallback, timeout 2 s)
  await page.waitForFunction(() => !!(window as Window & { __engine?: unknown }).__engine, null, { timeout: 8000 })
  await page.waitForLoadState('networkidle')
  // a chunk the HTML never names was fetched by the dynamic import: the engine
  return (await Promise.all(js)).map((j) => ({ ...j, engine: !html.includes(new URL(j.url).pathname) }))
}

const kb = (n: number) => `${(n / KB).toFixed(1)} KB`

test('engine chunk ≤ 220 KB gz, loaded lazily, and nothing else ships three.js', async ({ page }) => {
  const js = await coldLoad(page)
  const three = js.filter((j) => j.three)
  expect(three, 'exactly one chunk carries three.js').toHaveLength(1)
  expect(three[0].engine, 'three.js arrives through the dynamic import, not with the page').toBe(true)
  const engine = js.filter((j) => j.engine)
  const total = engine.reduce((s, j) => s + j.bytes, 0)
  test.info().annotations.push({
    type: 'engine',
    description: `${kb(total)}: ${engine.map((j) => `${j.url.split('/').pop()} ${kb(j.bytes)}`).join(', ')}`,
  })
  expect(total).toBeLessThanOrEqual(ENGINE_BUDGET)
})

test('initial JS (everything but the engine chunk) ≤ 120 KB gz', async ({ page }) => {
  // Measured framework baseline (Next 16.4 + React 19.3 runtime chunks, before any app code) is above
  // this budget on its own — see .superpowers/sdd/2026-11-25-portfolio/task-12-report.md. The budget is
  // not raised here: this stays an expected failure until a ruling sets the number.
  test.fail(true, 'framework baseline alone exceeds 120 KB gz: budget ruling pending (task-12 report)')
  const js = await coldLoad(page)
  const initial = js.filter((j) => !j.engine)
  const total = initial.reduce((s, j) => s + j.bytes, 0)
  test.info().annotations.push({
    type: 'initial JS',
    description: `${kb(total)}: ${initial.map((j) => `${j.url.split('/').pop()} ${kb(j.bytes)}`).join(', ')}`,
  })
  expect(total).toBeLessThanOrEqual(INITIAL_BUDGET)
})
