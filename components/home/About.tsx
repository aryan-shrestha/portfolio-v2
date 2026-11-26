'use client'

import { useEffect, useRef, useState } from 'react'

const TEXT =
  "I'm a full-stack developer in Kathmandu, now a software engineer at Maitri Services. Before that, at Data to Insights AI, I built frontends, APIs and data pipelines for client products. I take on freelance projects too, from first sketch to a site that's live."
const HIGHLIGHT = 'frontends, APIs and data pipelines'

const WORDS: { w: string; hl: boolean }[] = (() => {
  const start = TEXT.indexOf(HIGHLIGHT)
  const end = start + HIGHLIGHT.length
  const out: { w: string; hl: boolean }[] = []
  let at = 0
  for (const w of TEXT.split(' ')) {
    out.push({ w, hl: at >= start && at < end })
    at += w.length + 1
  }
  return out
})()

/**
 * Section 2 (spec §6.1): 150svh tall with a 100svh sticky pin; words light up in order as
 * progress = clamp((−top + 0.35H) / (height − 0.4H), 0, 1). Reduced motion: all on (CSS).
 */
export function About() {
  const ref = useRef<HTMLElement>(null)
  const [on, setOn] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const H = window.innerHeight
      const p = Math.min(1, Math.max(0, (-r.top + 0.35 * H) / (r.height - 0.4 * H)))
      // word i is on when i / words < p
      setOn(Math.min(WORDS.length, Math.ceil(p * WORDS.length)))
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

  return (
    <section ref={ref} data-place="left" className="grid-bg relative h-[150svh]">
      <div className="sticky top-0 flex h-svh items-center px-(--m)">
        <p className="ml-auto w-[min(56%,820px)] font-display text-[clamp(24px,3.2vw,46px)] font-bold leading-[1.15] tracking-[-0.02em] phone:-mt-[30svh] phone:w-full">
          {WORDS.map(({ w, hl }, i) => (
            <span key={i}>
              <span className={`about-word${hl ? ' hl' : ''}${i < on ? ' on' : ''}`}>{w}</span>
              {i < WORDS.length - 1 ? ' ' : null}
            </span>
          ))}
        </p>
      </div>
      {/* Without JavaScript nothing lights the words up: show them all. */}
      <noscript>
        <style>{'.about-word{opacity:1}'}</style>
      </noscript>
    </section>
  )
}
