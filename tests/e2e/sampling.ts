import type { Page } from '@playwright/test'

/** Per-frame silhouette sampler (R13): [minX, maxX, top] in window px from debugState(), every frame. */
export type Sample = [number, number, number]
type SamplerWindow = Window & {
  __engine?: { debugState(): { minX: number; maxX: number; top: number } }
  __samples?: Sample[]
  __sampling?: boolean
}

export const startSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as SamplerWindow
    w.__samples = []
    w.__sampling = true
    const loop = () => {
      if (!w.__sampling) return
      const d = w.__engine!.debugState()
      w.__samples!.push([d.minX, d.maxX, d.top])
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
  })

export const stopSampling = (page: Page) =>
  page.evaluate(() => {
    const w = window as SamplerWindow
    w.__sampling = false
    return w.__samples!
  })
