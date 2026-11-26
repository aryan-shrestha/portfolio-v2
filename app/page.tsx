import { About } from '@/components/home/About'
import { Chapter } from '@/components/home/Chapter'
import { Contact } from '@/components/home/Contact'
import { Experience } from '@/components/home/Experience'
import { Hero } from '@/components/home/Hero'
import { Narration } from '@/components/home/Narration'
import { chapters } from '@/content/chapters'
import { getAllWork } from '@/lib/content'

// Static content, read once at module scope so the page prerenders (cacheComponents).
const work = await getAllWork()
const titleOf = new Map(work.map((w) => [w.slug, w.title]))
function title(slug: string): string {
  const t = titleOf.get(slug)
  if (!t) throw new Error(`No content/work/${slug}.mdx for chapter "${slug}"`)
  return t
}

export default function Home() {
  return (
    <main>
      <Hero />
      <About />
      {chapters.map((c) => (
        <Chapter key={c.slug} chapter={c} title={title(c.slug)} />
      ))}
      <Experience />
      <Contact />
      <Narration />
    </main>
  )
}
