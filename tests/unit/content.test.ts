import { describe, expect, it } from 'vitest'
import { chapters } from '@/content/chapters'
import { getAllWork, getWork, parseWorkMeta } from '@/lib/content'

const valid = {
  title: 'T',
  slug: 't',
  year: 2025,
  builtAt: 'CloudProAI',
  myPart: 'Part',
  stack: ['A'],
  liveUrl: 'https://example.com/',
  tint: '#000000',
  highlight: '#ffffff',
  heroImage: '/work/t-hero.webp',
  problem: 'P',
  built: 'B',
}

describe('parseWorkMeta', () => {
  it('rejects an object missing myPart', () => {
    const { myPart: _omit, ...rest } = valid
    void _omit
    expect(() => parseWorkMeta(rest)).toThrow()
  })

  it('rejects a frontmatter slug that differs from the file name', () => {
    expect(() => parseWorkMeta(valid, 'other')).toThrow(/slug "t" does not match the file name "other.mdx"/)
    expect(parseWorkMeta(valid, 't').slug).toBe('t')
  })

  it('accepts an object without images, diagram, outcomes', () => {
    const meta = parseWorkMeta(valid)
    expect(meta.images).toBeUndefined()
    expect(meta.diagram).toBeUndefined()
    expect(meta.outcomes).toBeUndefined()
  })
})

describe('work content', () => {
  it('lists the three projects in order with exact stacks', async () => {
    const all = await getAllWork()
    expect(all.map((w) => w.slug)).toEqual([
      'napa-valley-weddings',
      'bevlytics',
      'data-to-insights',
    ])
    expect(all.every((w) => w.builtAt === 'CloudProAI')).toBe(true)
    expect(all[0].stack).toEqual(['Next.js', 'Python', 'FastAPI'])
    expect(all[1].stack).toEqual(['Python', 'AWS Lambda', 'Snowflake', 'CloudWatch'])
    expect(all[2].stack).toEqual(['NestJS', 'React', 'PostgreSQL', 'Zod', 'TanStack'])
  })

  it('has no outcomes on any entry', async () => {
    for (const w of await getAllWork()) expect(w.outcomes).toBeUndefined()
  })

  it('getWork returns meta and source', async () => {
    const { meta, source } = await getWork('bevlytics')
    expect(meta.diagram).toBe('bevlytics')
    expect(typeof source).toBe('string')
  })
})

describe('chapters', () => {
  it('has 3 chapters of 3 lines with the specified styling and gestures', () => {
    expect(chapters).toHaveLength(3)
    expect(chapters.every((c) => c.lines.length === 3)).toBe(true)
    expect(chapters.map((c) => c.side)).toEqual(['left', 'right', 'left'])
    expect(chapters.map((c) => c.tint)).toEqual(['#24402d', '#f6c9d8', '#151413'])
    expect(chapters.map((c) => c.highlight)).toEqual(['#8a6a1f', '#b0144f', '#c2410c'])
    expect(chapters.map((c) => c.lines.map((l) => l.gesture).join(','))).toEqual([
      'wave,point,thumbs',
      'wave,think,thumbs',
      'wave,point,think',
    ])
  })
})
