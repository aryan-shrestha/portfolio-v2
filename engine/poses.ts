import type { Action, Gesture } from './types'

/** Target pose for one frame; the runtime damps the rig toward it. Angles in radians. */
export type Pose = {
  bodyZ: number
  bodyY: number
  headZ: number
  headX: number
  /** shoulder z-rotation per arm, [left (side −1), right (side +1)] */
  sh: [number, number]
  /** gesture elbow z-rotation per arm (the runtime folds it while the arm swings, spec §7.5.3) */
  el: [number, number]
  /** open mouth */
  open: boolean
  /** open dot eyes (surprise) */
  wide: boolean
}

export type PoseKind = 'idle' | 'drag' | Gesture | Extract<Action, 'wave' | 'dance' | 'panic'>

export type PoseCtx = {
  /** seconds since load: drives the idle bob and the drag flail */
  now: number
  /** the side the screens are on (+1 right, −1 left): point and thumbs use that arm */
  toward: 1 | -1
  /** horizontal drag velocity, px per frame */
  vx: number
}

/** Seconds each timed pose plays before he returns to idle (spec §7.4: 1.5–4 s). */
export const DURATION: Partial<Record<PoseKind, number>> = {
  wave: 2.2,
  dance: 4,
  panic: 2.6,
  think: 2.2,
  point: 2.2,
  thumbs: 1.8,
  cheer: 2.4,
}

export const hasPose = (k: string): k is PoseKind => k === 'idle' || k === 'drag' || k in DURATION

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Pose `kind` at `t` seconds into it (ported from prototype v12's tick). */
export function poseFor(kind: PoseKind, t: number, ctx: PoseCtx): Pose {
  const p: Pose = {
    bodyZ: 0,
    bodyY: Math.sin(ctx.now * 1.6) * 0.02,
    headZ: 0,
    headX: 0,
    sh: [-0.14, 0.14],
    el: [0, 0],
    open: false,
    wide: false,
  }
  const A = ctx.toward > 0 ? 1 : 0 // arm on the screens' side
  const side = ctx.toward
  switch (kind) {
    case 'wave':
      p.sh[0] = -2.55
      p.el[0] = -(0.3 + 0.45 * Math.sin(t * 13))
      p.headZ = 0.12
      p.open = true
      break
    case 'dance': {
      const b = Math.sin(t * 9)
      p.bodyZ = b * 0.14
      p.bodyY = Math.abs(b) * 0.18
      p.headZ = -b * 0.2
      p.open = true
      p.sh = [-1.1 - b * 0.5, 1.1 - b * 0.5]
      p.el = [-1.4, 1.4]
      break
    }
    case 'panic': {
      const j = Math.sin(t * 40)
      p.sh = [-2.7 + j * 0.15, 2.7 + j * 0.15]
      p.el = [-0.4 + j * 0.3, 0.4 - j * 0.3]
      p.bodyZ = j * 0.04
      p.open = true
      p.wide = true
      break
    }
    case 'think':
      p.sh[0] = -2.5
      p.el[0] = -2.1 - 0.12 * Math.sin(t * 8)
      p.headZ = 0.16
      p.headX = -0.18
      break
    case 'point':
      p.sh[A] = side * 1.5
      p.el[A] = side * 0.15
      p.headZ = -side * 0.05
      p.open = true
      break
    case 'thumbs':
      p.sh[A] = side * 0.7
      p.el[A] = side * (1.9 + 0.1 * Math.sin(t * 10))
      p.headZ = 0.08
      break
    case 'cheer':
      p.sh = [-2.6, 2.6]
      p.el = [-0.5, 0.5]
      p.bodyY = Math.abs(Math.sin(t * 7)) * 0.15
      p.open = true
      break
    case 'drag': {
      const f = Math.sin(ctx.now * 22)
      p.sh = [-2.35 + f * 0.3, 2.35 + f * 0.3]
      p.el = [-0.5 - f * 0.3, 0.5 - f * 0.3]
      p.open = true
      p.wide = true
      p.bodyZ = clamp(-ctx.vx * 0.02, -0.3, 0.3)
      break
    }
  }
  return p
}
