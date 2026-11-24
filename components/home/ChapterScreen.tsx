'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { bayerMask, DISSOLVE_MS, DISSOLVE_STEPS } from '@/lib/dissolve'
import { SCREEN_EVENT } from '@/lib/narration'

const CELL = 3 // px per dither cell
const MASK_SIZE = `${CELL * 4}px ${CELL * 4}px`

type Props = {
  /** Distinct screens of the chapter, rendered on the server. */
  slides: ReactNode[]
  /** Narration line index → slide index. */
  lineToSlide: number[]
}

/**
 * The browser frame's content (spec §6.3). When a line activates, the incoming screen is laid
 * over the current one and revealed through a stepped 4×4 Bayer mask (16 steps, 400 ms), so it
 * resolves from ordered-dither dots. Reduced motion: instant swap.
 */
export function ChapterScreen({ slides, lineToSlide }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const first = lineToSlide[0] ?? 0
  const [base, setBase] = useState(first)
  const [top, setTop] = useState<number | null>(null)
  const [level, setLevel] = useState(0)
  const live = useRef({ base: first, top: null as number | null, raf: 0 })

  useEffect(() => {
    const section = ref.current?.closest('section')
    if (!section) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const s = live.current

    const settle = (i: number) => {
      cancelAnimationFrame(s.raf)
      s.raf = 0
      s.base = i
      s.top = null
      setBase(i)
      setTop(null)
      setLevel(0)
    }

    const onScreen = (e: Event) => {
      const next = lineToSlide[(e as CustomEvent<{ line: number }>).detail.line]
      if (next === undefined) return
      if (s.top !== null) settle(s.top) // finish a dissolve still in flight
      if (next === s.base) return
      if (reduce.matches) return settle(next)

      s.top = next
      setTop(next)
      setLevel(0)
      const t0 = performance.now()
      const stepMs = DISSOLVE_MS / DISSOLVE_STEPS
      const tick = (now: number) => {
        const lv = Math.floor((now - t0) / stepMs) + 1
        if (lv >= DISSOLVE_STEPS) return settle(next)
        setLevel(lv)
        s.raf = requestAnimationFrame(tick)
      }
      s.raf = requestAnimationFrame(tick)
    }

    section.addEventListener(SCREEN_EVENT, onScreen)
    return () => {
      section.removeEventListener(SCREEN_EVENT, onScreen)
      cancelAnimationFrame(s.raf)
    }
  }, [lineToSlide])

  return (
    <div
      ref={ref}
      className="relative aspect-[16/10] max-h-[calc(100svh-300px)] w-full overflow-hidden bg-paper phone:max-h-[34svh]"
    >
      {slides.map((slide, i) => {
        const incoming = i === top
        const visible = incoming || i === base
        let style: CSSProperties | undefined
        if (incoming) {
          const mask = `url("${bayerMask(level, CELL)}")`
          style = { maskImage: mask, WebkitMaskImage: mask, maskSize: MASK_SIZE, WebkitMaskSize: MASK_SIZE }
        }
        return (
          <div
            key={i}
            data-slide={i}
            data-state={incoming ? 'incoming' : visible ? 'shown' : 'hidden'}
            aria-hidden={visible ? undefined : true}
            inert={!visible}
            className={`absolute inset-0 ${visible ? '' : 'invisible'} ${incoming ? 'z-10' : ''}`}
            style={style}
          >
            {slide}
          </div>
        )
      })}
    </div>
  )
}
