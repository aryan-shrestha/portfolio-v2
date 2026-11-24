'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { EngineAPI } from '@/engine/types'
import type { Gesture } from '@/engine/types'
import { CASE_COMMENTS, QUIPS } from '@/engine/quips'

declare global {
  interface Window {
    __engine?: EngineAPI
  }
}

const GESTURES = new Set<string>(['wave', 'point', 'thumbs', 'think', 'cheer'])
/** Case pages: how long his comment shows before he shrinks into the badge (spec §6.6). */
const CASE_COMMENT_MS = 4000
/** Ignore scrolling in the first moments after a navigation (the router's own scroll-to-top). */
const SCROLL_ARM_MS = 300
const EXPOSE = process.env.NEXT_PUBLIC_E2E === '1' || process.env.NODE_ENV === 'development'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The engine reads a section's placement from `data-place`; the case page's own root stays `right`. */
let badgeStub: HTMLElement | null = null
function badgeSection(): HTMLElement {
  if (!badgeStub) {
    badgeStub = document.createElement('div')
    badgeStub.dataset.place = 'badge'
  }
  return badgeStub
}

/**
 * The character layer (spec §5, §7.2, §7.7): rendered once in the root layout so it persists across
 * routes. The engine chunk (three.js + model) is imported only after the page is idle.
 */
export function CharacterLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const [engine, setEngine] = useState<EngineAPI | null>(null)
  const pathname = usePathname()

  // Load and mount the engine once, off the critical path.
  useEffect(() => {
    let cancelled = false
    let made: EngineAPI | null = null
    const load = () => {
      import('@/engine')
        .then(({ createEngine }) => {
          const [c, h, b, g] = [canvasRef.current, handleRef.current, bubbleRef.current, badgeRef.current]
          if (cancelled || !c || !h || !b || !g) return
          const e = createEngine()
          try {
            e.mount(c, h, b, g)
          } catch {
            e.destroy() // no WebGL: the page stays readable without him (fallback image: Task 12)
            return
          }
          made = e
          setEngine(e)
        })
        .catch(() => {
          // chunk failed to load: the site works without the character
        })
    }
    const idle = typeof window.requestIdleCallback === 'function'
    const handle = idle ? window.requestIdleCallback(load, { timeout: 2000 }) : window.setTimeout(load, 1)
    return () => {
      cancelled = true
      if (idle) window.cancelIdleCallback(handle)
      else window.clearTimeout(handle)
      made?.destroy()
    }
  }, [])

  // Page events: narration gestures, copied email, pokes.
  useEffect(() => {
    if (!engine) return
    const onLine = (e: Event) => {
      const g = (e as CustomEvent<{ gesture?: string }>).detail?.gesture
      // Reduced motion: no automatic gestures (spec §7.8).
      if (g && GESTURES.has(g) && !reducedMotion()) engine.gesture(g as Gesture)
    }
    const onCopied = () => engine.say(QUIPS.copied, 2500)
    window.addEventListener('narration:line', onLine)
    window.addEventListener('email:copied', onCopied)
    // The action menu arrives in Task 10; for now a poke is a wave.
    const offPoke = engine.onPoke(() => engine.play('wave'))
    return () => {
      window.removeEventListener('narration:line', onLine)
      window.removeEventListener('email:copied', onCopied)
      offPoke()
    }
  }, [engine])

  // Every route: hand the new page's sections over; case pages get a comment, then the badge.
  useEffect(() => {
    if (!engine) return
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-place]')).filter(
      (el) => el.getClientRects().length > 0,
    )
    engine.setSections(sections)
    const slug = sections.find((el) => el.dataset.caseComment)?.dataset.caseComment
    if (!slug) return

    engine.say(CASE_COMMENTS[slug] ?? '', CASE_COMMENT_MS)
    let baseline = 0
    const onScroll = () => {
      if (Math.abs(window.scrollY - baseline) > 4) toBadge()
    }
    const toBadge = () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(timer)
      engine.say('')
      engine.setSections([badgeSection()])
    }
    const arm = window.setTimeout(() => {
      baseline = window.scrollY
      window.addEventListener('scroll', onScroll, { passive: true })
    }, SCROLL_ARM_MS)
    const timer = window.setTimeout(toBadge, CASE_COMMENT_MS)
    return () => {
      window.clearTimeout(arm)
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [engine, pathname])

  // Test/dev hook, declared last so it appears once the listeners and sections above are in place.
  useEffect(() => {
    if (!engine || !EXPOSE) return
    window.__engine = engine
    return () => {
      if (window.__engine === engine) delete window.__engine
    }
  }, [engine])

  return (
    <>
      <div ref={badgeRef} data-char="badge" aria-hidden="true" className="char-badge" />
      <canvas ref={canvasRef} data-char="canvas" aria-hidden="true" className="char-canvas" />
      <div ref={handleRef} data-char="handle" aria-hidden="true" className="char-handle" />
      <div ref={bubbleRef} data-char="bubble" aria-hidden="true" className="char-bubble" />
    </>
  )
}
