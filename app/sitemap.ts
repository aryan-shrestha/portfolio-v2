import type { MetadataRoute } from 'next'
import { getAllWork } from '@/lib/content'
import { siteUrl } from '@/lib/siteUrl'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const work = await getAllWork()
  return [
    { url: `${siteUrl}/`, changeFrequency: 'monthly', priority: 1 },
    ...work.map((w) => ({ url: `${siteUrl}/work/${w.slug}`, changeFrequency: 'yearly' as const, priority: 0.8 })),
    { url: `${siteUrl}/dress-up`, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
