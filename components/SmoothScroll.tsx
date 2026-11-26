'use client'

import { useEffect } from 'react'

/**
 * Smooth wheel scrolling (Lenis), site-wide. Loaded after the page is idle, off the critical path.
 * Lenis drives the window's own scroll position, so everything that reads `window.scrollY` (the
 * character's scroll-scrubbed tour, the narration, the About words) follows it unchanged.
 *
 * - Touch keeps native scrolling (`syncTouch` off): phones already have momentum.
 * - Reduced motion: no Lenis at all, native scrolling; it follows the setting if it changes mid-visit.
 * - Anchor links ("Get in touch ↓") stay native instant jumps (`anchors` off), so the
 *   character plays only the destination's gesture (N11), not every section he would glide past.
 * - Clicking an internal link stops any glide still running toward the old page's position.
 * - Inner scroll areas opt out with `data-lenis-prevent` (the dress-up controls on wide screens).
 */
export function SmoothScroll() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let cancelled = false
    let lenis: { destroy(): void; scrollTo(y: number, o: { immediate: true }): void } | null = null
    const start = () => {
      if (lenis || reduce.matches) return
      import('lenis')
        .then(({ default: Lenis }) => {
          if (cancelled || lenis || reduce.matches) return
          lenis = new Lenis({
            autoRaf: true,
            lerp: 0.1,
            syncTouch: false,
            anchors: false,
            stopInertiaOnNavigate: true,
          })
        })
        .catch(() => {
          // chunk failed to load: native scrolling still works
        })
    }
    const stop = () => {
      lenis?.destroy()
      lenis = null
    }
    const onMotion = () => (reduce.matches ? stop() : start())
    const idle = typeof window.requestIdleCallback === 'function'
    const handle = idle ? window.requestIdleCallback(start, { timeout: 2000 }) : window.setTimeout(start, 1)
    reduce.addEventListener('change', onMotion)
    return () => {
      cancelled = true
      if (idle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
      reduce.removeEventListener('change', onMotion)
      stop()
    }
  }, [])

  return null
}
