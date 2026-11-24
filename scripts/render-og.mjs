#!/usr/bin/env node
/**
 * Renders the share image and the icons from the built site, so they use its own fonts, tokens and the
 * dithered still of him (public/character/still.png, Aryan's own look):
 *
 *   public/og.png        1200 × 630  paper + grid, name, the hero headline and sub-line, him on the right
 *   app/icon.png          256 × 256  the badge: his head in a white circle with the vermilion ring
 *   app/apple-icon.png    180 × 180  the same badge on paper (iOS rounds the corners itself)
 *
 *   npm run build && npm run start -- -p 3100
 *   node scripts/render-og.mjs [baseURL]          # default http://localhost:3100
 *
 * Page scripts are blocked: the server-rendered page only lends its stylesheet and fonts.
 */
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.argv[2] ?? 'http://localhost:3100'

// Copy from the hero (spec §6.1): facts only.
const OG = `
<div class="grid-bg" style="position:fixed;inset:0;overflow:hidden;background-color:var(--paper);color:var(--ink)">
  <div style="position:absolute;left:64px;top:56px">
    <p class="display" style="font-size:30px;letter-spacing:-0.02em;line-height:1.1">Aryan Shrestha</p>
    <p style="font-family:var(--font-dm-mono);font-size:19px;margin-top:6px">Full-stack developer</p>
  </div>
  <div style="position:absolute;left:64px;bottom:60px;width:700px">
    <h1 class="display" style="font-size:118px;font-weight:800">I build the<br><em style="font-style:normal;color:var(--accent)">whole</em> thing.</h1>
    <p style="font-size:25px;line-height:1.4;color:var(--muted);margin-top:28px">Frontend, backend and the data in between.<br>Freelance full-stack developer in Kathmandu.</p>
  </div>
  <img src="/character/still.png" alt="" style="position:absolute;right:56px;top:118px;width:400px;height:500px;image-rendering:pixelated">
</div>`

// The badge (spec §6.1 badge placement): head centred in a white circle, vermilion ring.
const badge = (size, ground) => `
<div style="position:fixed;inset:0;background:${ground};display:grid;place-items:center">
  <div style="width:${size}px;height:${size}px;border-radius:50%;background:#fff;border:${Math.round(size * 0.05)}px solid var(--accent);overflow:hidden;position:relative">
    <img src="/character/still.png" alt="" style="position:absolute;width:${size * 1.5}px;left:50%;top:${-size * 0.06}px;transform:translateX(-50%);image-rendering:pixelated">
  </div>
</div>`

const shots = [
  { file: 'public/og.png', w: 1200, h: 630, html: OG },
  { file: 'app/icon.png', w: 256, h: 256, html: badge(256, 'transparent'), omitBackground: true },
  { file: 'app/apple-icon.png', w: 180, h: 180, html: badge(152, 'var(--paper)') },
]

const browser = await chromium.launch()
try {
  for (const s of shots) {
    const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 1 })
    await page.route('**/*.js', (r) => r.abort())
    await page.goto(base)
    await page.evaluate((html) => {
      document.body.innerHTML = html
      document.body.style.background = 'transparent'
    }, s.html)
    await page.evaluate(async () => {
      await document.fonts.ready
      await Promise.all([...document.images].map((i) => i.decode()))
    })
    await page.screenshot({ path: join(root, s.file), omitBackground: !!s.omitBackground })
    console.log(`wrote ${s.file} (${s.w}×${s.h})`)
    await page.close()
  }
} finally {
  await browser.close()
}
