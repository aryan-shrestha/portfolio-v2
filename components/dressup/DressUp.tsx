import type { ReactNode } from 'react'
import Link from 'next/link'
import { LazyDressUpControls } from './LazyDressUpControls'

/**
 * The dress-up page (spec §7.6), also the 404 (spec §5). The root declares the `stage` placement; the
 * engine centres him on `[data-stage]` (the empty area under the heading) and stands him on its bottom
 * edge. Desktops and every landscape screen: stage left, controls right. Portrait phones and tablets:
 * the stage is a band pinned to the top and the controls scroll beneath it, so they never sit under him.
 * The stage keeps at least 200 px (he stays ≥ 180 px tall); a long heading (the 404's) is set smaller
 * so it stays within two lines on short screens.
 */
const INTRO = 'Change my hair, colours and outfit. I keep the look while you browse.'

const TITLE_SIZE = {
  short: 'max-w-[16ch] text-[clamp(30px,min(6vw,9svh),88px)]',
  long: 'max-w-[30ch] text-[clamp(22px,min(5.4vw,6.5svh),64px)]',
}

export function DressUp({
  title,
  intro = INTRO,
  titleSize = 'short',
}: {
  title: ReactNode
  intro?: ReactNode
  /** `long` for a heading of more than a few words (the 404's) */
  titleSize?: keyof typeof TITLE_SIZE
}) {
  return (
    <main
      data-place="stage"
      className="grid-bg flex min-h-svh flex-col wide:grid wide:h-svh wide:grid-cols-[minmax(0,1fr)_clamp(260px,36vw,420px)]"
    >
      <div className="grid-bg sticky top-0 z-10 flex min-h-[52svh] flex-col bg-paper wide:static wide:h-auto wide:min-h-0 wide:bg-transparent">
        <header className="px-(--m) pt-[clamp(12px,3svh,40px)]">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-mono text-sm underline decoration-1 underline-offset-4 hover:decoration-2"
          >
            ← Home
          </Link>
          <h1 className={`display mt-[clamp(4px,2svh,24px)] font-extrabold text-balance ${TITLE_SIZE[titleSize]}`}>
            {title}
          </h1>
          <p className="mt-4 max-w-[40ch] text-[clamp(16px,1.3vw,19px)] text-ink/80 phone:hidden">{intro}</p>
        </header>
        {/* his stage: kept empty, he stands on its bottom edge */}
        <div data-stage aria-hidden="true" className="min-h-[200px] flex-1" />
      </div>
      <section
        aria-labelledby="dressup-controls"
        className="relative px-(--m) pt-6 pb-[max(var(--m),env(safe-area-inset-bottom))] wide:overflow-y-auto wide:py-[clamp(16px,3svh,40px)] wide:pl-0"
      >
        <div className="rounded-2xl border-2 border-ink bg-white p-[clamp(20px,1.8vw,26px)] shadow-[6px_6px_0_rgba(0,0,0,0.35)]">
          <LazyDressUpControls
            heading={
              <h2 id="dressup-controls" className="display text-[clamp(26px,2.4vw,34px)] font-extrabold">
                Pick a look
              </h2>
            }
          />
        </div>
      </section>
    </main>
  )
}
