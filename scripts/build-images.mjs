// Builds public/work/* from the source screenshots. Privacy crops per spec §9.
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = process.env.SRC_DIR ?? path.resolve(root, '../portfolio/public/images')
const OUT = path.join(root, 'public/work')
mkdirSync(OUT, { recursive: true })

const APP_CROP = { left: 0, top: 105, width: 2940, height: 1460 } // drops sidebar header + account block
const heroes = [
  { src: 'napa-valley-weddings.png', out: 'napa-hero', slug: 'napa', ink: '#24402d' },
  { src: 'bevlytics.png', out: 'bevlytics-hero', slug: 'bevlytics', ink: '#b0144f' },
  {
    src: 'data-to-insights.png',
    out: 'dti-hero',
    slug: 'dti',
    ink: '#151413',
    crop: { left: 0, top: 0, width: 2938, height: 1480 }, // drops embedded third-party user block
  },
]
const extras = [
  { src: 'data-to-insights-3.png', out: 'dti-actions', crop: APP_CROP },
  { src: 'data-to-insights-2.png', out: 'dti-chat', crop: APP_CROP },
]

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))

// sharp without .withMetadata() drops EXIF on output.
async function webp({ src, out, crop }) {
  let img = sharp(path.join(SRC, src))
  if (crop) img = img.extract(crop)
  await img.resize({ width: 2400, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, `${out}.webp`))
}

async function cover({ src, slug, ink, crop }) {
  let img = sharp(path.join(SRC, src))
  if (crop) img = img.extract(crop)
  const W = 720, H = 480, CELL = 2
  const w = W / CELL, h = H / CELL
  const grey = await img
    .resize(W, H, { fit: 'cover', position: 'top' })
    .resize(w, h)
    .grayscale()
    .raw()
    .toBuffer()
  const dark = hex(ink), light = [255, 255, 255]
  const px = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cx = (x / CELL) | 0, cy = (y / CELL) | 0
      const t = (BAYER[(cy % 4) * 4 + (cx % 4)] + 0.5) / 16
      const c = grey[cy * w + cx] / 255 < t ? dark : light
      px.set(c, (y * W + x) * 3)
    }
  }
  await sharp(px, { raw: { width: W, height: H, channels: 3 } }).png({ palette: false }).toFile(path.join(OUT, `cover-${slug}.png`))
}

for (const h of heroes) {
  await webp(h)
  await cover(h)
}
for (const e of extras) await webp(e)
console.log('images built ->', OUT)
