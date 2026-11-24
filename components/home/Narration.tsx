'use client'

import { useEffect } from 'react'
import { activeLineIndex, DESKTOP_BAND, SCREEN_EVENT } from '@/lib/narration'

/**
 * Drives the chapters' narration lines (spec §6.3): exactly one `.line` is `.on`; lines above
 * the band are `.past`. On activation it dispatches `narration:line` { gesture } on window (the
 * character engine plays it) and `narration:screen` { line } on the line's section (its
 * ChapterScreen dissolves to that line's screen). Renders nothing.
 */
export function Narration() {
  useEffect(() => {
    const lines = Array.from(document.querySelectorAll<HTMLElement>('.line[data-line]'))
    if (lines.length === 0) return
    const phone = window.matchMedia('(max-width: 900px)')
    let active: HTMLElement | null = null
    let raf = 0

    const update = () => {
      raf = 0
      const H = window.innerHeight
      const mobile = phone.matches
      const rects = lines.map((l) => l.getBoundingClientRect())
      const i = activeLineIndex(
        rects.map((r) => r.top),
        rects.map((r) => r.bottom),
        H,
        mobile,
      )
      const pastAbove = mobile ? 0 : H * DESKTOP_BAND[0]
      lines.forEach((l, k) => {
        l.classList.toggle('on', k === i)
        l.classList.toggle('past', k !== i && rects[k].top < pastAbove)
      })
      const next = i === -1 ? null : lines[i]
      if (next && next !== active) {
        window.dispatchEvent(
          new CustomEvent('narration:line', { detail: { gesture: next.dataset.gesture } }),
        )
        next.closest('section')?.dispatchEvent(
          new CustomEvent(SCREEN_EVENT, { detail: { line: Number(next.dataset.line) } }),
        )
      }
      active = next
    }
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  return null
}
