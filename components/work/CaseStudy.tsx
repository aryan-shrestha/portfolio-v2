import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { compileMDX } from 'next-mdx-remote/rsc'
import { Diagram } from '@/components/home/Diagram'
import { BrowserFrame } from '@/components/ui/BrowserFrame'
import { Button } from '@/components/ui/Button'
import type { WorkMeta } from '@/lib/content'

/** Intrinsic sizes of the published screenshots (Task 3 pipeline), so images reserve their space. */
const SIZES: Record<string, [number, number]> = {
  '/work/napa-hero.webp': [2400, 1446],
  '/work/bevlytics-hero.webp': [2400, 1324],
  '/work/dti-hero.webp': [2400, 1209],
  '/work/dti-actions.webp': [2400, 1192],
  '/work/dti-chat.webp': [2400, 1192],
}

const host = (url: string) => new URL(url).hostname.replace(/^www\./, '')
const isLight = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return r * 0.299 + g * 0.587 + b * 0.114 > 150
}

function Shot({ src, alt, priority }: { src: string; alt: string; priority?: boolean }) {
  const [width, height] = SIZES[src] ?? [2400, 1400]
  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      sizes="(max-width: 900px) 100vw, 70vw"
      className="block h-auto w-full"
    />
  )
}

/** Section heading with the project's highlight bar in front of it (every H2 on the page). */
function H2({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span aria-hidden="true" className="mt-2 h-2 w-8 shrink-0 rounded-full bg-(--hl)" />
      <h2 id={id} className="display text-[clamp(32px,4vw,64px)] font-extrabold">
        {children}
      </h2>
    </div>
  )
}

/**
 * Case-study page (spec §6.6): tinted header band (back link, title, facts, stack, live link),
 * hero in a browser frame, The problem, What I built (+ diagram), optional more images, next project.
 * The section root declares the character's `right` placement; on desktop a right gutter of
 * 0.85 × hero S × 3.5 keeps content clear of him (phones: none, he is a badge by then).
 */
export async function CaseStudy({ meta, source, next }: { meta: WorkMeta; source: string; next: WorkMeta }) {
  const { content: extra } = await compileMDX({ source })
  const light = isLight(meta.tint)
  const vars = {
    '--tint': meta.tint,
    '--fg': light ? '#111110' : '#f6f4ee',
    '--hl': meta.highlight,
    '--gl': light ? 'var(--grid-line-light)' : 'var(--grid-line-dark)',
    '--focus': light ? '#111110' : '#f6f4ee',
  } as CSSProperties
  const gutter = 'pr-[calc(var(--char-s,100px)*0.85*3.5)] phone:pr-(--m)'
  const heroHost = host(meta.liveUrl)

  return (
    <section data-place="right" data-case-comment={meta.slug} className="bg-paper" style={vars}>
      <header className="grid-bg bg-(--tint) text-(--fg)">
        <div className={`px-(--m) pt-6 pb-[clamp(32px,7svh,72px)] ${gutter}`}>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-mono text-sm underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            ← Home
          </Link>
          <h1 className="display mt-[clamp(24px,6svh,64px)] text-[clamp(44px,8vw,136px)] font-extrabold">
            {meta.title}
          </h1>
          <ul aria-label="Project facts" className="mt-8 grid max-w-[860px] gap-y-5 text-[17px]">
            <li className="font-mono text-sm">
              {meta.year}
              <span aria-hidden="true"> · </span>
              Built at {meta.builtAt}
            </li>
            <li>
              <span className="block font-mono text-xs uppercase tracking-wider">My part</span>
              {meta.myPart}
            </li>
          </ul>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <ul aria-label="Stack" className="flex flex-wrap gap-2">
              {meta.stack.map((s) => (
                <li key={s} className="rounded-full border-[1.5px] border-(--fg) px-3 py-1 font-mono text-sm">
                  {s}
                </li>
              ))}
            </ul>
            <a
              href={meta.liveUrl}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center font-medium underline decoration-2 underline-offset-4 hover:decoration-4"
            >
              Live link ↗
            </a>
          </div>
        </div>
      </header>

      <div className={`px-(--m) py-[clamp(40px,8svh,88px)] ${gutter}`}>
        <div className="max-w-[1100px]">
          <BrowserFrame host={heroHost}>
            <Shot src={meta.heroImage} alt={`${meta.title} in a browser`} priority />
          </BrowserFrame>
        </div>

        <div className="mt-[clamp(48px,10svh,112px)] grid max-w-[1100px] gap-[clamp(32px,6svh,64px)]">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-10 gap-y-4 phone:grid-cols-1">
            <H2 id="problem">The problem</H2>
            <p className="max-w-[60ch] text-[clamp(18px,1.6vw,22px)] leading-relaxed">{meta.problem}</p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-10 gap-y-4 phone:grid-cols-1">
            <H2 id="built">What I built</H2>
            <div className="grid gap-6">
              <p className="max-w-[60ch] text-[clamp(18px,1.6vw,22px)] leading-relaxed">{meta.built}</p>
              {extra}
              {meta.diagram ? (
                <div className="aspect-[8/5] max-w-[720px] overflow-hidden rounded-xl border border-black/20">
                  <Diagram id={meta.diagram} />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {meta.images?.length ? (
          <section aria-labelledby="more-images" className="mt-[clamp(48px,10svh,112px)] max-w-[1100px]">
            <H2 id="more-images">More images</H2>
            <div className="mt-8 grid gap-10">
              {meta.images.map((src) => (
                <BrowserFrame key={src} host={heroHost}>
                  <Shot src={src} alt={`${meta.title} ${src.split('-').pop()?.replace('.webp', '')} screen`} />
                </BrowserFrame>
              ))}
            </div>
          </section>
        ) : null}

        <nav
          aria-label="Next project"
          className="mt-[clamp(56px,12svh,128px)] flex max-w-[1100px] flex-wrap items-center justify-between gap-6 border-t-[1.5px] border-ink pt-8"
        >
          <p className="display text-[clamp(28px,3.5vw,52px)] font-extrabold">{next.title}</p>
          <Button href={`/work/${next.slug}`}>Next project →</Button>
        </nav>
      </div>
    </section>
  )
}
