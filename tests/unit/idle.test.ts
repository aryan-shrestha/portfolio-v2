import { describe, expect, it } from 'vitest'
import { IDLE, IDLE_EMOTES, createIdle } from '@/engine/idle'

/**
 * Idle behaviour (v1.2, owner): after 20 s with no input he plays a random short emote every 15–30 s;
 * at 60 s he dozes off (yawn, then sleep until any input, which wakes him with a startled hop); back
 * on the tab after ≥ 15 s away, he waves hello. `canAct` is false while he is busy (an action playing,
 * a drag, the menu open, a glide): events wait for him rather than being dropped.
 */
describe('idle scheduler', () => {
  const seq = (...xs: number[]) => {
    let i = 0
    return () => xs[i++ % xs.length]
  }

  it('uses the agreed timings', () => {
    expect(IDLE).toEqual({ firstEmote: 20, every: [15, 30], sleepAfter: 60, returnAfter: 15 })
    expect([...IDLE_EMOTES].sort()).toEqual(['hiccup', 'peekaboo', 'sneeze', 'think', 'thumbs', 'wave'])
  })

  it('first emote at 20 s of no input, then every 15–30 s (random), until sleep at 60 s', () => {
    // random() = 0 → 15 s gaps; picks the first emote each time
    const idle = createIdle({ now: 0, random: seq(0) })
    expect(idle.tick(19.9, true)).toBeNull()
    expect(idle.tick(20, true)).toEqual({ kind: 'emote', pose: IDLE_EMOTES[0] })
    expect(idle.tick(34.9, true)).toBeNull()
    expect(idle.tick(35, true)?.kind).toBe('emote')
    expect(idle.tick(50, true)?.kind).toBe('emote')
    expect(idle.tick(60, true)).toEqual({ kind: 'doze' })
    expect(idle.asleep).toBe(true)
    // asleep: no more emotes
    expect(idle.tick(200, true)).toBeNull()
  })

  it('random() = 1 → 30 s gaps; the emote is picked by random() too', () => {
    const idle = createIdle({ now: 0, random: seq(0.999) })
    expect(idle.tick(20, true)).toEqual({ kind: 'emote', pose: IDLE_EMOTES[IDLE_EMOTES.length - 1] })
    expect(idle.tick(49.9, true)).toBeNull()
    expect(idle.tick(50, true)?.kind).toBe('emote')
  })

  it('never the same emote twice in a row', () => {
    const idle = createIdle({ now: 0, random: seq(0, 0, 0, 0, 0.5) })
    const a = idle.tick(20, true)
    const b = idle.tick(35, true)
    expect(a?.kind === 'emote' && b?.kind === 'emote' && a.pose !== b.pose).toBe(true)
  })

  it('input resets the clock; while busy, a due event waits instead of being dropped', () => {
    const idle = createIdle({ now: 0, random: seq(0) })
    idle.input(10)
    expect(idle.tick(29, true)).toBeNull()
    expect(idle.tick(30, false)).toBeNull() // busy
    expect(idle.tick(31, true)?.kind).toBe('emote') // as soon as he is free
  })

  it('any input wakes him: one wake event, then the clock starts over', () => {
    const idle = createIdle({ now: 0, random: seq(0) })
    expect(idle.tick(60, true)).toEqual({ kind: 'doze' })
    expect(idle.input(75)).toEqual({ kind: 'wake' })
    expect(idle.asleep).toBe(false)
    expect(idle.input(76)).toBeNull()
    expect(idle.tick(95, true)).toBeNull()
    expect(idle.tick(96, true)?.kind).toBe('emote')
  })

  it('back on the tab after ≥ 15 s away: a welcome (and awake); a short switch does nothing', () => {
    const idle = createIdle({ now: 0, random: seq(0) })
    idle.hidden(5)
    expect(idle.visible(10)).toBeNull()
    idle.hidden(12)
    expect(idle.visible(27)).toEqual({ kind: 'welcome' })
    // asleep when you left: the welcome replaces the wake
    idle.tick(87, true)
    expect(idle.asleep).toBe(true)
    idle.hidden(90)
    expect(idle.visible(200)).toEqual({ kind: 'welcome' })
    expect(idle.asleep).toBe(false)
    // and the idle clock starts from the return
    expect(idle.tick(219, true)).toBeNull()
    expect(idle.tick(220, true)?.kind).toBe('emote')
  })

  it('scale shortens every timing (tests only)', () => {
    const idle = createIdle({ now: 0, random: seq(0), scale: 0.01 })
    expect(idle.tick(0.2, true)?.kind).toBe('emote')
    expect(idle.tick(0.6, true)).toEqual({ kind: 'doze' })
  })
})

describe('idle scheduler switched off (e2e builds: scale = Infinity)', () => {
  it('never emits anything, and a tab return is not a welcome', () => {
    const idle = createIdle({ now: 0, scale: Infinity })
    for (const t of [20, 60, 600, 6000]) expect(idle.tick(t, true)).toBeNull()
    expect(idle.asleep).toBe(false)
    idle.hidden(10)
    expect(idle.visible(5000)).toBeNull()
  })
})
