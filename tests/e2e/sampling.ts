import { expect, type Page } from '@playwright/test'
import sharp from 'sharp'

/**
 * Per-frame sampler (R13, R15): every animation frame, debugState() gives the silhouette [minX, maxX, top]
 * in window px, plus the rendered canvas's own edge dots [left, right, top] (opaque dots in the leftmost
 * column, the column holding the window's last pixel, and the top row, read back right after the engine
 * drew that frame; debugProbe), what he is doing and where.
 */
export type Sample = [
  minX: number,
  maxX: number,
  top: number,
  edgeL: number,
  edgeR: number,
  edgeT: number,
  action: string | null,
  placement: string,
  /** the badge's clip circle alone keeps him inside the padded window (ruling R20): silhouette exempt */
  clip: boolean,
]
type Debug = {
  minX: number
  maxX: number
  top: number
  action: string | null
  placement: string
  edge: [number, number, number]
  clipContained?: boolean
}
type SamplerWindow = Window & {
  __engine?: { debugState(): Debug; debugProbe(on: boolean): void; play(a: string): void }
  __samples?: Sample[]
  __sampling?: boolean
}

export const startSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as SamplerWindow
    w.__engine!.debugProbe(true)
    w.__samples = []
    w.__sampling = true
    const loop = () => {
      if (!w.__sampling) return
      const d = w.__engine!.debugState()
      w.__samples!.push([d.minX, d.maxX, d.top, d.edge[0], d.edge[1], d.edge[2], d.action, d.placement, !!d.clipContained])
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })

/** Waits (polling, no fixed time) until at least `n` frames have been sampled: slow software GL draws fewer per second. */
export const sampledFrames = (page: Page, n: number) =>
  page.waitForFunction((n) => ((window as SamplerWindow).__samples?.length ?? 0) >= n, n, { timeout: 20_000 })

export const stopSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as SamplerWindow
    w.__sampling = false
    w.__engine!.debugProbe(false)
    return w.__samples!
  })

/**
 * Plays `action` and samples every frame until he is back to idle: by the engine's own clock (its time
 * step is capped, so on slow software GL an action takes longer than its duration), not a wall-clock
 * window. Asserts the action really played and really ended, so a no-op can't pass on idle frames.
 */
export async function playSampled(page: Page, action: string, timeout = 60_000): Promise<Sample[]> {
  await startSampling(page)
  await page.evaluate((a) => (window as SamplerWindow).__engine!.play(a), action)
  await page.waitForFunction(
    () => {
      const s = (window as SamplerWindow).__samples!
      return s.some((x) => x[6] !== null) && s.length > 1 && s[s.length - 1][6] === null
    },
    null,
    { timeout },
  )
  const samples = await stopSampling(page)
  expect(samples.some((x) => x[6] === action), `${action}: frames where it plays`).toBe(true)
  expect(samples.at(-1)![6], `${action}: the last frame is idle again`).toBeNull()
  return samples
}

/**
 * Every sampled frame keeps him off the left, right and top edge (spec §7.5): no rendered dot in the
 * edge column/row, on every frame; and the silhouette inside [0, W] × [0, ∞), except on frames where the
 * badge's clip circle alone keeps him inside the window (ruling R20: nothing outside the circle is drawn).
 */
export function expectInside(label: string, samples: Sample[], W: number, minFrames = 4) {
  expect(samples.length, `${label}: frames sampled`).toBeGreaterThanOrEqual(minFrames)
  samples.forEach(([minX, maxX, top, l, r, t, action, placement, clip], i) => {
    const at = `${label} frame ${i} (${placement}, ${action ?? 'idle'})`
    expect([l, r, t], `${at}: rendered dots on the [left, right, top] edge`).toEqual([0, 0, 0])
    if (clip) return
    expect(minX, `${at} left`).toBeGreaterThanOrEqual(0)
    expect(maxX, `${at} right`).toBeLessThanOrEqual(W)
    expect(top, `${at} top`).toBeGreaterThanOrEqual(0)
  })
}

/** Index of the widest sampled frame (max silhouette width). */
export const widest = (samples: Sample[]) =>
  samples.reduce((best, s, i) => (s[1] - s[0] > samples[best][1] - samples[best][0] ? i : best), 0)

const HIDE_PAGE_ID = 'edge-scan-hide'

/**
 * Screenshot edge scan (R15): with everything but the character canvas hidden on a mid-grey page,
 * screenshot the window's column 0, column W−1 and row 0 and count pure-white (#ffffff), ink
 * (< 30,30,30) and vermilion pixels — anything of him an outline or dither dot drew past the Box3
 * silhouette. Returns the count per edge.
 */
export async function screenshotEdges(page: Page): Promise<{ left: number; right: number; top: number }> {
  const [W, H] = await page.evaluate((id) => {
    if (!document.getElementById(id)) {
      const s = document.createElement('style')
      s.id = id
      s.textContent =
        'html, body { background: #808080 !important; } body > *:not([data-char="canvas"]) { visibility: hidden !important; }'
      document.head.append(s)
    }
    return [document.documentElement.clientWidth, innerHeight]
  }, HIDE_PAGE_ID)
  const count = async (clip: { x: number; y: number; width: number; height: number }) => {
    const png = await page.screenshot({ clip, animations: 'allow', caret: 'initial' })
    const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let n = 0
    for (let i = 0; i < data.length; i += info.channels) {
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const white = r >= 250 && g >= 250 && b >= 250
      const ink = r < 30 && g < 30 && b < 30
      const vermilion = Math.abs(r - 226) < 30 && Math.abs(g - 70) < 35 && Math.abs(b - 44) < 35
      if (white || ink || vermilion) n++
    }
    return n
  }
  return {
    left: await count({ x: 0, y: 0, width: 1, height: H }),
    right: await count({ x: W - 1, y: 0, width: 1, height: H }),
    top: await count({ x: 0, y: 0, width: W, height: 1 }),
  }
}

export const showPage = (page: Page) =>
  page.evaluate((id) => document.getElementById(id)?.remove(), HIDE_PAGE_ID)
