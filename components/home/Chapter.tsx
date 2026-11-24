import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { BrowserFrame } from '@/components/ui/BrowserFrame'
import { Bubble } from '@/components/ui/Bubble'
import { Button } from '@/components/ui/Button'
import type { ChapterData, Screen } from '@/content/chapters'
import { ChapterScreen } from './ChapterScreen'
import { Diagram } from './Diagram'

const screenKey = (s: Screen) => (s.kind === 'image' ? s.src : `diagram:${s.id}`)

function Slide({ screen }: { screen: Screen }) {
  if (screen.kind === 'diagram') return <Diagram id={screen.id} />
  return (
    <Image
      src={screen.src}
      alt={screen.alt}
      fill
      sizes="(max-width: 900px) 100vw, 58vw"
      className="object-cover object-top"
    />
  )
}

/**
 * A project chapter (spec §6.2): full-bleed tint with the grid, a sticky 100svh stage holding
 * the title, "View project →" and the browser frame on the side opposite the character; the
 * narration lines scroll over the stage on the character's side.
 */
export function Chapter({ chapter, title }: { chapter: ChapterData; title: string }) {
  const right = chapter.side === 'right'
  const light = chapter.fg.toLowerCase() === '#111110'

  // One slide per distinct screen; lines that repeat a screen share its slide.
  const keys: string[] = []
  const slides: ReactNode[] = []
  const lineToSlide = chapter.lines.map(({ screen }) => {
    const k = screenKey(screen)
    let i = keys.indexOf(k)
    if (i === -1) {
      i = keys.push(k) - 1
      slides.push(<Slide key={k} screen={screen} />)
    }
    return i
  })

  const vars = {
    '--tint': chapter.tint,
    '--fg': chapter.fg,
    '--hl': chapter.highlight,
    '--gl': light ? 'var(--grid-line-light)' : 'var(--grid-line-dark)',
    '--focus': chapter.fg,
  } as CSSProperties

  return (
    <section
      data-place={chapter.side}
      data-outfit={chapter.outfit}
      aria-label={title}
      className="grid-bg relative bg-(--tint) text-(--fg)"
      style={vars}
    >
      <div className="chapter-stage sticky top-0 h-svh overflow-hidden px-(--m) pt-[clamp(56px,8svh,80px)] pb-(--m) phone:pt-8">
        <div
          className={`flex w-[58%] items-end justify-between gap-5 phone:w-full phone:flex-col phone:items-start phone:gap-4 ${right ? 'mr-auto' : 'ml-auto'}`}
        >
          <h2 className="display text-[clamp(36px,5vw,92px)] font-extrabold">{title}</h2>
          <Button href={`/work/${chapter.slug}`}>View project →</Button>
        </div>
        <div
          className={`mt-[clamp(20px,4svh,48px)] w-[58%] phone:w-full ${right ? 'mr-auto' : 'ml-auto'}`}
        >
          <BrowserFrame host={chapter.host}>
            <ChapterScreen slides={slides} lineToSlide={lineToSlide} />
          </BrowserFrame>
        </div>
      </div>

      <div className="chapter-lines pointer-events-none relative -mt-[100svh] px-(--m) pt-[42svh] pb-[40svh] phone:pt-[68svh]">
        {chapter.lines.map((line, i) => (
          <div
            key={i}
            data-line={i}
            data-gesture={line.gesture}
            className={`line min-h-[36svh] w-[min(34%,460px)] phone:min-h-[38svh] phone:w-[78%] ${right ? 'ml-auto phone:ml-0' : 'phone:ml-auto'}`}
          >
            <Bubble highlight={chapter.highlight}>
              {/* Trusted static copy from content/chapters.ts (contains <b> only). */}
              <span dangerouslySetInnerHTML={{ __html: line.html }} />
            </Bubble>
          </div>
        ))}
      </div>
    </section>
  )
}
