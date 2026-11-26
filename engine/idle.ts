/**
 * Idle behaviour (v1.2, owner): what he does while nobody is doing anything. Pure and clock-driven;
 * the runtime feeds it input and visibility changes and asks it each frame what to do.
 *
 * - After `firstEmote` s with no input: a random short emote, then one every `every` s (never the same
 *   twice in a row).
 * - After `sleepAfter` s: he dozes off (yawn, then sleeps until any input, which wakes him).
 * - Back on the tab after ≥ `returnAfter` s away: a welcome (and awake).
 * Events that fall due while he is busy wait for him (`canAct`), they are not dropped.
 */

import type { Gesture } from './types'
import type { Action } from './types'

export const IDLE = { firstEmote: 20, every: [15, 30] as [number, number], sleepAfter: 60, returnAfter: 15 }

/** Gentle, short emotes for idle moments (no flying, vanishing or dancing out of nowhere). */
export const IDLE_EMOTES = ['think', 'thumbs', 'hiccup', 'sneeze', 'peekaboo', 'wave'] as const satisfies readonly (
  | Action
  | Gesture
)[]

export type IdleEvent =
  | { kind: 'emote'; pose: (typeof IDLE_EMOTES)[number] }
  | { kind: 'doze' }
  | { kind: 'wake' }
  | { kind: 'welcome' }

export function createIdle({ now, random = Math.random, scale = 1 }: { now: number; random?: () => number; scale?: number }) {
  const first = IDLE.firstEmote * scale
  const gap = () => (IDLE.every[0] + (IDLE.every[1] - IDLE.every[0]) * random()) * scale
  let quietSince = now
  let nextEmote = now + first
  let asleep = false
  let hiddenAt: number | null = null
  let last: string | null = null

  const reset = (t: number) => {
    quietSince = t
    nextEmote = t + first
  }
  const pick = (): (typeof IDLE_EMOTES)[number] => {
    let i = Math.min(IDLE_EMOTES.length - 1, Math.floor(random() * IDLE_EMOTES.length))
    if (IDLE_EMOTES[i] === last) i = (i + 1) % IDLE_EMOTES.length
    last = IDLE_EMOTES[i]
    return IDLE_EMOTES[i]
  }

  return {
    get asleep() {
      return asleep
    },
    /** Any input (scroll, pointer, key, touch). Returns a wake event if he was asleep. */
    input(t: number): IdleEvent | null {
      reset(t)
      if (!asleep) return null
      asleep = false
      return { kind: 'wake' }
    },
    hidden(t: number) {
      hiddenAt = t
    },
    visible(t: number): IdleEvent | null {
      const away = hiddenAt === null ? 0 : t - hiddenAt
      hiddenAt = null
      reset(t)
      if (away < IDLE.returnAfter * scale) return null
      asleep = false
      return { kind: 'welcome' }
    },
    /** Called every frame; `canAct` false while he is busy. */
    tick(t: number, canAct: boolean): IdleEvent | null {
      if (asleep || !canAct) return null
      if (t - quietSince >= IDLE.sleepAfter * scale) {
        asleep = true
        return { kind: 'doze' }
      }
      if (t >= nextEmote) {
        nextEmote = t + gap()
        return { kind: 'emote', pose: pick() }
      }
      return null
    },
  }
}

export type Idle = ReturnType<typeof createIdle>
