import Image from 'next/image'
import Link from 'next/link'
import type { WorkMeta } from '@/lib/content'

/** Dithered, tinted covers from the image pipeline (Task 3); names differ from the slugs. */
const COVERS: Record<string, string> = {
  'napa-valley-weddings': '/work/cover-napa.png',
  bevlytics: '/work/cover-bevlytics.png',
  'data-to-insights': '/work/cover-dti.png',
}

/**
 * Section 6 (spec §6.4): heading, count, 3→1 column grid of 3:2 covers linking to case studies.
 * Not mounted for now (owner, v1.2): re-add `<AllWork work={work} />` before `<Experience />` in
 * app/page.tsx, and restore its tests (git history) to bring it back.
 */
export function AllWork({ work }: { work: WorkMeta[] }) {
  return (
    <section
      id="work"
      data-place="badge"
      data-gesture="cheer"
      className="grid-bg px-(--m) pt-[16svh] pb-[30svh]"
    >
      <div className="flex items-end justify-between gap-4">
        <h2 className="display text-[clamp(44px,7vw,120px)] font-extrabold">All work</h2>
        <span className="text-muted">
          {work.length} {work.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <ul className="mt-[clamp(32px,6svh,64px)] grid grid-cols-3 gap-[clamp(16px,2vw,28px)] phone:grid-cols-1">
        {work.map((w) => (
          <li key={w.slug}>
            <Link href={`/work/${w.slug}`} className="group block rounded-[10px]">
              <div className="aspect-[3/2] overflow-hidden rounded-[10px] transition-transform duration-300 ease-out group-hover:-translate-y-0.5">
                {/* Real ordered-dither art: served as-is so resampling doesn't smear the dots. */}
                <Image
                  src={COVERS[w.slug] ?? w.heroImage}
                  alt=""
                  width={720}
                  height={480}
                  unoptimized
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
              </div>
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <span className="font-display text-xl font-bold tracking-[-0.02em] decoration-2 underline-offset-4 group-hover:underline">
                  {w.title}
                </span>
                <span className="text-[15px] text-muted">{w.year}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
