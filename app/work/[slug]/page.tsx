import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CaseStudy } from '@/components/work/CaseStudy'
import { getAllWork, getWork } from '@/lib/content'
import { ogImage } from '@/lib/siteUrl'

export const dynamicParams = false

export async function generateStaticParams() {
  return (await getAllWork()).map((w) => ({ slug: w.slug }))
}

export async function generateMetadata({ params }: PageProps<'/work/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const all = await getAllWork()
  const meta = all.find((w) => w.slug === slug)
  if (!meta) return {}
  return {
    title: meta.title,
    description: meta.problem,
    alternates: { canonical: `/work/${slug}` },
    openGraph: { title: `${meta.title} — Aryan Shrestha`, description: meta.problem, url: `/work/${slug}`, images: [ogImage] },
  }
}

export default async function WorkPage({ params }: PageProps<'/work/[slug]'>) {
  const { slug } = await params
  const all = await getAllWork()
  const i = all.findIndex((w) => w.slug === slug)
  if (i === -1) notFound()
  const { meta, source } = await getWork(slug)
  return (
    <main>
      <CaseStudy meta={meta} source={source} next={all[(i + 1) % all.length]} />
    </main>
  )
}
