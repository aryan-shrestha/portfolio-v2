import { describe, expect, it } from 'vitest'
import { certifications, roles } from '@/content/experience'
import { getAllWork } from '@/lib/content'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const n = (d: string) => {
  const [m, y] = d.split(' ')
  expect(MONTHS, d).toContain(m)
  return Number(y) * 12 + MONTHS.indexOf(m)
}

describe('experience content', () => {
  it('has one current role, first, and the rest newest first with start ≤ end', () => {
    expect(roles.filter((r) => !r.end)).toEqual([roles[0]])
    expect(roles[0].company).toBe('Maitri Services')
    for (const r of roles) if (r.end) expect(n(r.start)).toBeLessThanOrEqual(n(r.end))
    const starts = roles.map((r) => n(r.start))
    expect(starts).toEqual([...starts].sort((a, b) => b - a))
  })

  it('the case studies are credited to a company listed here (Data to Insights AI)', async () => {
    const work = await getAllWork()
    const companies = new Set(roles.map((r) => r.company))
    for (const w of work) expect(companies.has(w.builtAt), w.slug).toBe(true)
  })

  it('lists four certifications, newest first, each with an https credential link', () => {
    expect(certifications).toHaveLength(4)
    const issued = certifications.map((c) => n(c.issued))
    expect(issued).toEqual([...issued].sort((a, b) => b - a))
    for (const c of certifications) expect(c.url).toMatch(/^https:\/\//)
  })
})
