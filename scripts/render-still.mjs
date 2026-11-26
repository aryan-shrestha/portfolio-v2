#!/usr/bin/env node
/**
 * Renders the still image of him (spec §7.7–7.8) from the real engine: idle, held (no breathing, no
 * blink, no cursor look), Aryan's own look, ordered-dithered at 3 CSS px per dot into the frame in
 * engine/stillFrame.ts, transparent outside his silhouette. Output: public/character/still.png
 * (600 × 750, every dot a crisp 3 × 3 block), committed.
 *
 *   NEXT_PUBLIC_E2E=1 npm run build && npm run start -- -p 3100   # an e2e build exposes window.__engine
 *   node scripts/render-still.mjs [baseURL]                        # default http://localhost:3100
 *
 * Pass `--pose <action>` to render one action's held key pose instead (for review; not shipped).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const poseAt = args.indexOf('--pose')
const pose = poseAt >= 0 ? args[poseAt + 1] : 'idle'
const base = args.find((a, i) => !a.startsWith('--') && i !== poseAt + 1) ?? 'http://localhost:3100'
const out = pose === 'idle' ? join(root, 'public/character/still.png') : join(root, `still-${pose}.png`)

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  // A fresh context: no saved look, so it is Aryan's own. Reduced motion off: the live engine draws.
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.goto(base)
  await page.waitForFunction(() => !!window.__engine, null, { timeout: 15000 }).catch(() => {
    throw new Error(`no window.__engine at ${base}: serve an e2e build (NEXT_PUBLIC_E2E=1)`)
  })
  const shot = await page.evaluate((k) => window.__engine.debugStill(k), pose)
  if (!shot) throw new Error('debugStill returned null (no WebGL, or the window is smaller than the frame)')
  const png = Buffer.from(shot.png.split(',')[1], 'base64')
  const SCALE = 3 // CSS px per dot
  const img = await sharp(png)
    .extract({ left: shot.x, top: shot.y, width: shot.w, height: shot.h })
    .resize({ width: shot.w * SCALE, height: shot.h * SCALE, kernel: 'nearest' })
    // v1.2 colour dither: each surface has its own dot and gap colours (≈ a dozen in all), plus vermilion
    .png({ palette: true, colours: 32, compressionLevel: 9, effort: 10 })
    .toBuffer()
  // idle must sit wholly inside the frame: the outermost rows and columns are transparent (review poses may not)
  const { data, info } = await sharp(img).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const alpha = (x, y) => data[(y * info.width + x) * info.channels + 3]
  if (pose === 'idle') {
    for (let x = 0; x < info.width; x++)
      if (alpha(x, 0) > 0) throw new Error(`the frame cuts him at the top (x ${x})`)
    for (let y = 0; y < info.height - SCALE * 6; y++)
      if (alpha(0, y) > 0 || alpha(info.width - 1, y) > 0) throw new Error(`the frame cuts him at a side (y ${y})`)
  }
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, img)
  console.log(`wrote ${out} (${info.width}×${info.height}, ${img.length} bytes)`)
} finally {
  await browser.close()
}
