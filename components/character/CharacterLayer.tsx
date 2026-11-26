'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { EngineAPI, Gesture } from '@/engine/types'
import { StillFallback } from './StillFallback'

/** The lazily loaded half: engine, menu, lines, look (components/character/live.ts). */
type Live = typeof import('./live')
type Loaded = { engine: EngineAPI; live: Live; webgl: boolean }

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
/** The width where the layout turns into the phone layout (spec §6.1, §7.3 mobile mode). */
const PHONE = '(max-width: 900px)'
const MOBILE_QUIP_MS = 3500

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
 * routes. Everything about him but these few elements (engine, three.js, model, menu, lines) is one
 * dynamic import, made only after the page is idle. Under reduced motion the engine draws him as one
 * still frame; without WebGL it shows the still image (StillFallback) (spec §7.7–7.8, ruling R17).
 */
export function CharacterLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const stillRef = useRef<HTMLImageElement>(null)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const engine = loaded?.engine ?? null
  const pathname = usePathname()

  // Load and mount the engine once, off the critical path.
  useEffect(() => {
    let cancelled = false
    let made: EngineAPI | null = null
    const load = () => {
      import('./live')
        .then((live) => {
          const [c, h, b, g, s] = [canvasRef.current, handleRef.current, bubbleRef.current, badgeRef.current, stillRef.current]
          if (cancelled || !c || !h || !b || !g || !s) return
          const e = live.createEngine()
          // the visitor's saved look (spec §7.6), before the first build
          const look = live.getLook()
          e.setLook(look.base)
          e.setOutfit(look.outfit)
          // a returning visitor is greeted as one (spec §7.3); storage is optional
          if (live.checkIn()) e.setGreeting(live.QUIPS.returning)
          // false without WebGL: the still image, no interactions (spec §7.7)
          const webgl = e.mount(c, h, b, g, s)
          made = e
          setLoaded({ engine: e, live, webgl })
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

  // Page events: narration gestures, copied email. (Pokes open the action menu: ActionMenu.)
  useEffect(() => {
    if (!loaded) return
    const { engine, live } = loaded
    const onLine = (e: Event) => {
      const g = (e as CustomEvent<{ gesture?: string }>).detail?.gesture
      // Reduced motion: no automatic gestures (spec §7.8).
      if (g && GESTURES.has(g) && !reducedMotion()) engine.gesture(g as Gesture)
    }
    const onCopied = () => engine.say(live.QUIPS.copied, 2500)
    window.addEventListener('narration:line', onLine)
    window.addEventListener('email:copied', onCopied)
    return () => {
      window.removeEventListener('narration:line', onLine)
      window.removeEventListener('email:copied', onCopied)
    }
  }, [loaded])

  // Mobile mode (spec §7.3): when the window narrows past 900 px he remarks on it. Loading narrow is no crossing.
  useEffect(() => {
    if (!loaded) return
    const { engine, live } = loaded
    const phone = window.matchMedia(PHONE)
    const onChange = () => {
      if (phone.matches) engine.say(live.QUIPS.mobile, MOBILE_QUIP_MS)
    }
    phone.addEventListener('change', onChange)
    return () => phone.removeEventListener('change', onChange)
  }, [loaded])

  // Dress-up changes (and other tabs') reach him at once; the engine skips unchanged base traits.
  useEffect(() => {
    if (!loaded) return
    const { engine, live } = loaded
    const apply = () => {
      const look = live.getLook()
      engine.setLook(look.base)
      engine.setOutfit(look.outfit)
    }
    apply()
    return live.subscribeLook(apply)
  }, [loaded])

  // Every route: hand the new page's sections over; case pages get a comment, then the badge.
  useEffect(() => {
    if (!loaded) return
    const { engine, live, webgl } = loaded
    const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-place]')).filter(
      (el) => el.getClientRects().length > 0,
    )
    const slug = sections.find((el) => el.dataset.caseComment)?.dataset.caseComment
    // Still mode (reduced motion, no WebGL) has no entrance: straight to the badge, clear of the text.
    if (slug && (!webgl || reducedMotion())) {
      engine.setSections([badgeSection()])
      return
    }
    engine.setSections(sections)
    if (!slug) return

    engine.say(live.CASE_COMMENTS[slug] ?? '', CASE_COMMENT_MS)
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
  }, [loaded, pathname])

  // Test/dev hook, declared last so it appears once the listeners and sections above are in place.
  useEffect(() => {
    if (!engine || !EXPOSE) return
    // e2e builds start with the idle routines off, so tests that watch him for 20 s+ see only what they
    // asked for; tests/e2e/idle.spec.ts turns them on (debugIdle). Dev and production keep them.
    if (process.env.NEXT_PUBLIC_E2E === '1') engine.debugIdle(Infinity)
    window.__engine = engine
    return () => {
      if (window.__engine === engine) delete window.__engine
    }
  }, [engine])

  const Menu = loaded?.webgl ? loaded.live.ActionMenu : null
  return (
    <>
      <div ref={badgeRef} data-char="badge" aria-hidden="true" className="char-badge" />
      <canvas ref={canvasRef} data-char="canvas" aria-hidden="true" className="char-canvas" />
      <div ref={handleRef} data-char="handle" aria-hidden="true" className="char-handle" />
      <div ref={bubbleRef} data-char="bubble" aria-hidden="true" className="char-bubble" />
      <StillFallback ref={stillRef} />
      {/* keyed by route: a navigation closes the menu; without WebGL there is nothing to play with */}
      {Menu ? <Menu key={pathname} engine={loaded!.engine} /> : null}
    </>
  )
}
