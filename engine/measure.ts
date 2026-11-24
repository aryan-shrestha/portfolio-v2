import { Box3 } from 'three'
import type { Look } from './look'
import { buildCharacter, type Rig } from './model/build'
import { applyPose } from './pose-rig'
import { DURATION, poseFor, type PoseKind } from './poses'
import { silhouette } from './silhouette'
import type { Action, Gesture } from './types'

/** Every pose he can be in: idle, carried, the twelve actions and the five gestures. */
export const ALL_KINDS: readonly PoseKind[] = ['idle', 'drag', ...(Object.keys(DURATION) as (Action | Gesture)[])]
/** The kinds that set the top bound BOX.y1 (spec §7.5.2: idle and the widest moves). */
export const TOP_KINDS: readonly PoseKind[] = ['idle', 'wave', 'dance', 'panic', 'drag']

/** Model units around the character origin. */
export type Bounds = {
  /** leftmost and rightmost point over every frame */
  x0: number
  x1: number
  /** highest point over every frame */
  y1: number
  /** widest single frame (what sizing must fit: he is never in two frames at once) */
  width: number
  /** highest point less the body's lift on that frame (fly hovers; the runtime clamp handles lifts) */
  y1Grounded: number
}

const DT = 1 / 60

/**
 * Plays one pose kind the way the runtime does (ruling R13): 60 fps from a settled idle with the
 * runtime's damping and elbow fold (applyPose), on both sides of the page, through the return to idle.
 * Drag sweeps its velocity tilt (±0.3) for 3 s; idle runs 3 s. `frame` sees the rig after each step.
 */
export function simulate(look: Look, kind: PoseKind, frame: (rig: Rig, t: number, toward: 1 | -1) => void): void {
  for (const toward of [1, -1] as const) {
    const rig = buildCharacter(look)
    applyPose(rig, poseFor('idle', 0, { now: 0, toward, vx: 0 }), Infinity)
    const len = kind === 'idle' || kind === 'drag' ? 3 : DURATION[kind] + 0.8
    for (let f = 0; f * DT <= len; f++) {
      const t = f * DT
      applyPose(rig, poseFor(kind, t, { now: t, toward, vx: kind === 'drag' ? 40 * Math.sin(t * 2) : 0 }), DT)
      frame(rig, t, toward)
    }
    rig.dispose()
  }
}

/** Headless sweep of `kinds` for one look: the silhouette bounds over every simulated frame. */
export function measureBounds(look: Look, kinds: readonly PoseKind[]): Bounds {
  const b: Bounds = { x0: Infinity, x1: -Infinity, y1: -Infinity, width: 0, y1Grounded: -Infinity }
  const box = new Box3()
  for (const kind of kinds)
    simulate(look, kind, (rig) => {
      silhouette(rig.root, box)
      b.x0 = Math.min(b.x0, box.min.x)
      b.x1 = Math.max(b.x1, box.max.x)
      b.y1 = Math.max(b.y1, box.max.y)
      b.width = Math.max(b.width, box.max.x - box.min.x)
      b.y1Grounded = Math.max(b.y1Grounded, box.max.y - Math.max(0, rig.body.position.y))
    })
  return b
}
