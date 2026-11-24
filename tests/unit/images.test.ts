import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

const dir = path.resolve(__dirname, '../../public/work')
const webps = ['napa-hero', 'bevlytics-hero', 'dti-hero', 'dti-actions', 'dti-chat']
const covers = ['napa', 'bevlytics', 'dti']

describe('image pipeline outputs', () => {
  it.each(webps)('%s.webp exists, width <= 2400, no EXIF', async (name) => {
    const file = path.join(dir, `${name}.webp`)
    expect(existsSync(file)).toBe(true)
    const meta = await sharp(file).metadata()
    expect(meta.width).toBeLessThanOrEqual(2400)
    expect(meta.exif).toBeUndefined()
  })

  it('dti-hero.webp is cropped to the top 1480 source px', async () => {
    const meta = await sharp(path.join(dir, 'dti-hero.webp')).metadata()
    expect(meta.height).toBeLessThanOrEqual(Math.round(1480 * (2400 / 2938)))
  })

  it('never publishes excluded files', () => {
    for (const f of readdirSync(dir)) {
      for (const bad of ['bevlytics-2', 'bevlytics-3', 'me']) {
        expect(f.includes(bad), `${f} contains ${bad}`).toBe(false)
      }
    }
  })

  it.each(covers)('cover-%s.png is 720x480 with exactly 2 colours', async (slug) => {
    const file = path.join(dir, `cover-${slug}.png`)
    expect(existsSync(file)).toBe(true)
    const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    expect([info.width, info.height]).toEqual([720, 480])
    const colours = new Set<number>()
    for (let i = 0; i < data.length; i += info.channels) {
      colours.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
    }
    expect(colours.size).toBe(2)
  })
})
