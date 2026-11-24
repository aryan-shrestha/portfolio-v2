import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, type Look } from '@/engine/look'
import { LOOK_KEY, loadLook, parseLook, saveLook } from '@/engine/lookStore'

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
const throwing = (): Storage => ({
  ...memory(),
  getItem: () => {
    throw new DOMException('denied', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('full', 'QuotaExceededError')
  },
})

const custom: Look = {
  base: { hair: 'curly-top', hairColor: '#b8863b', skin: '#6e4630', hoodie: '#2f4a6b', glasses: true },
  outfit: 'detective',
}

describe('loadLook', () => {
  it('storage whose getItem throws → DEFAULT_LOOK', () => {
    expect(loadLook(throwing())).toEqual(DEFAULT_LOOK)
  })
  it('nothing stored → DEFAULT_LOOK', () => {
    expect(loadLook(memory())).toEqual(DEFAULT_LOOK)
  })
  it('stored "not json" → DEFAULT_LOOK', () => {
    expect(loadLook(memory({ [LOOK_KEY]: 'not json' }))).toEqual(DEFAULT_LOOK)
  })
  it('stored object with an unknown hair style → DEFAULT_LOOK', () => {
    const bad = { ...custom, base: { ...custom.base, hair: 'mohawk' } }
    expect(loadLook(memory({ [LOOK_KEY]: JSON.stringify(bad) }))).toEqual(DEFAULT_LOOK)
  })
  it('valid round-trip is preserved', () => {
    const s = memory()
    saveLook(custom, s)
    expect(loadLook(s)).toEqual(custom)
  })
  it('returns a copy: mutating the result never changes DEFAULT_LOOK', () => {
    const l = loadLook(memory())
    l.base.hair = 'buzz'
    l.outfit = 'hardhat'
    expect(DEFAULT_LOOK.base.hair).toBe('wavy-fringe')
    expect(DEFAULT_LOOK.outfit).toBe('hoodie')
  })
})

describe('saveLook', () => {
  it('swallows a throwing setItem', () => {
    expect(() => saveLook(custom, throwing())).not.toThrow()
  })
  it('works without any storage (no window in node)', () => {
    expect(() => saveLook(custom)).not.toThrow()
    expect(loadLook()).toEqual(DEFAULT_LOOK)
  })
})

describe('parseLook', () => {
  it('accepts every valid option', () => {
    expect(parseLook(JSON.parse(JSON.stringify(custom)))).toEqual(custom)
    expect(parseLook(DEFAULT_LOOK)).toEqual(DEFAULT_LOOK)
  })
  it.each([
    ['null', null],
    ['a number', 3],
    ['an array', []],
    ['no base', { outfit: 'hoodie' }],
    ['unknown outfit', { ...custom, outfit: 'tuxedo' }],
    ['colour outside the swatches', { ...custom, base: { ...custom.base, hairColor: '#ff00ff' } }],
    ['skin outside the swatches', { ...custom, base: { ...custom.base, skin: 'red' } }],
    ['hoodie outside the swatches', { ...custom, base: { ...custom.base, hoodie: '#000' } }],
    ['glasses not a boolean', { ...custom, base: { ...custom.base, glasses: 'yes' } }],
    ['prototype key as hair', { ...custom, base: { ...custom.base, hair: 'constructor' } }],
  ])('rejects %s', (_, v) => {
    expect(parseLook(v)).toBeNull()
  })
  it('drops unknown extra keys', () => {
    const extra = { ...custom, base: { ...custom.base, hat: 'x' }, extra: 1 }
    expect(parseLook(extra)).toEqual(custom)
  })
})
