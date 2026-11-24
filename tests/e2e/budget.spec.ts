import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { expect, test, type Page } from '@playwright/test'

/**
 * Size budgets (spec §10 as amended by ruling R16): on a cold first load of `/` (cache disabled), the
 * gzip transfer size of the initial JS — every JS request except the lazy engine chunk — ≤ 160 KB, of
 * which app-owned ≤ 30 KB; the engine chunk ≤ 220 KB. (R16: spec §10's 120 KB is below the Next 16 +
 * React 19 framework floor, ~132 KB gz on the wire for an empty app.) Sizes are
 * the encoded bodies the server sent (`next start` gzips). Classified by import origin: the page's
 * initial JS is what its HTML names; the engine is what the one dynamic import (components/character/
 * live.ts, after idle) fetches on top: the three.js chunk (it carries WebGLRenderer) plus the small
 * chunk of character code split off it. `noModule` polyfills are never fetched by a module browser.
 */
const KB = 1024
const INITIAL_BUDGET = 160 * KB
const APP_BUDGET = 30 * KB
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

/**
 * App-owned chunks, by module origin (ruling R16): the build's client-reference manifest for `/` maps every
 * client module to the chunks that load it. A chunk that any of our own modules (a client module outside
 * node_modules) loads is app-owned; the rest of the initial JS is the framework (React, the Next router,
 * the Turbopack runtime). A chunk that mixes our code with framework code counts as ours (conservative).
 * Read from the `.next` build that `npm run e2e` serves.
 */
function appOwnedChunks(): Set<string> {
  const file = join(process.cwd(), '.next/server/app/page_client-reference-manifest.js')
  const sandbox: { globalThis?: unknown; __RSC_MANIFEST?: Record<string, { clientModules: Record<string, { chunks: string[] }> }> } =
    {}
  sandbox.globalThis = sandbox
  runInNewContext(readFileSync(file, 'utf8'), sandbox)
  const { clientModules } = sandbox.__RSC_MANIFEST!['/page']
  const own = new Set<string>()
  for (const [id, m] of Object.entries(clientModules))
    if (id.startsWith('[project]/') && !id.includes('/node_modules/')) m.chunks.forEach((c) => own.add(c))
  return own
}

test('initial JS: app-owned ≤ 30 KB gz, total ≤ 160 KB gz (ruling R16)', async ({ page }) => {
  const js = await coldLoad(page)
  const initial = js.filter((j) => !j.engine)
  const own = appOwnedChunks()
  const app = initial.filter((j) => own.has(new URL(j.url).pathname))
  const total = initial.reduce((s, j) => s + j.bytes, 0)
  const appBytes = app.reduce((s, j) => s + j.bytes, 0)
  const list = (l: Js[]) => l.map((j) => `${j.url.split('/').pop()} ${kb(j.bytes)}`).join(', ')
  test.info().annotations.push(
    { type: 'initial JS', description: `${kb(total)}: ${list(initial)}` },
    { type: 'app-owned', description: `${kb(appBytes)}: ${list(app)}` },
    { type: 'framework', description: kb(total - appBytes) },
  )
  // the manifest belongs to the build being served: our client components' chunks were all fetched
  expect(app.length, 'app-owned chunks found among the fetched initial JS').toBeGreaterThan(0)
  expect(appBytes).toBeLessThanOrEqual(APP_BUDGET)
  expect(total).toBeLessThanOrEqual(INITIAL_BUDGET)
})
