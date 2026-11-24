import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { z } from 'zod'

const workMetaSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  year: z.number().int(),
  builtAt: z.literal('CloudProAI'),
  myPart: z.string().min(1),
  stack: z.array(z.string().min(1)).min(1),
  liveUrl: z.string().url(),
  tint: z.string().min(1),
  highlight: z.string().min(1),
  heroImage: z.string().min(1),
  problem: z.string().min(1),
  built: z.string().min(1),
  images: z.array(z.string().min(1)).optional(),
  diagram: z.enum(['napa', 'bevlytics']).optional(),
  outcomes: z.string().min(1).optional(),
})

export type WorkMeta = z.infer<typeof workMetaSchema>

const WORK_DIR = path.join(process.cwd(), 'content', 'work')

const ORDER = ['napa-valley-weddings', 'bevlytics', 'data-to-insights']

export function parseWorkMeta(data: unknown): WorkMeta {
  return workMetaSchema.parse(data)
}

export async function getWork(slug: string): Promise<{ meta: WorkMeta; source: string }> {
  const raw = await fs.readFile(path.join(WORK_DIR, `${slug}.mdx`), 'utf8')
  const { data, content } = matter(raw)
  return { meta: parseWorkMeta(data), source: content }
}

export async function getAllWork(): Promise<WorkMeta[]> {
  const files = (await fs.readdir(WORK_DIR)).filter((f) => f.endsWith('.mdx'))
  const slugs = files.map((f) => f.replace(/\.mdx$/, ''))
  const metas = await Promise.all(slugs.map(async (s) => (await getWork(s)).meta))
  const rank = (slug: string) => {
    const i = ORDER.indexOf(slug)
    return i === -1 ? ORDER.length : i
  }
  return metas.sort((a, b) => rank(a.slug) - rank(b.slug))
}
