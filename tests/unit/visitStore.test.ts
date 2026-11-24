import { describe, expect, it } from 'vitest'
import { VISIT_KEY, checkIn } from '@/engine/visitStore'

/** In-memory Storage. */
function memory(init: Record<string, string> = {}): Storage {
  const m = new Map(Object.entries(init))
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

describe('returning-visitor flag (spec §7.3)', () => {
  it('a first visit is not a return, and is remembered', () => {
    const s = memory()
    expect(checkIn(s)).toBe(false)
    expect(s.getItem(VISIT_KEY)).toBe('1')
  })

  it('the next visit is a return', () => {
    const s = memory()
    checkIn(s)
    expect(checkIn(s)).toBe(true)
  })

  it('never throws when storage throws (privacy modes): counts as a first visit', () => {
    const throwing: Storage = {
      ...memory(),
      getItem: () => {
        throw new DOMException('denied', 'SecurityError')
      },
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError')
      },
    }
    expect(() => checkIn(throwing)).not.toThrow()
    expect(checkIn(throwing)).toBe(false)
  })

  it('works with no storage at all (server, or window.localStorage throwing)', () => {
    expect(checkIn(null)).toBe(false)
  })
})
