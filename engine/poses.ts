import type { Action, Emote, Gesture } from './types'

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
  /** lift off the ground, model units (fly) */
  rootY?: number
  /** 0–1: dithers him out (vanish); 1 when absent */
  visible?: number
  /** shoulder pitch per arm (rotation x); negative swings the arm forward, toward the viewer */
  fwd?: [number, number]
  /** body yaw (spin, turn away); radians, may run past 2π */
  turn?: number
  /** head yaw that overrides the cursor look */
  headY?: number
  /** eyes squeezed shut */
  shut?: boolean
  /** 0–1 camera flash over the whole window (selfie) */
  flash?: number
  /** phone scale per hand, 0 hidden … 1 shown (selfie) */
  phone?: [number, number]
  /** laptop scale, 0 hidden … 1 shown (deploying) */
  laptop?: number
}

export type PoseKind = 'idle' | 'drag' | Action | Gesture | Emote

export type PoseCtx = {
  /** seconds since load: drives the idle bob and the drag flail */
  now: number
  /** the side the screens are on (+1 right, −1 left): point, thumbs, selfie and fly use that arm */
  toward: 1 | -1
  /** horizontal drag velocity, px per frame */
  vx: number
}

/** Seconds each timed pose plays before he returns to idle (spec §7.4: 1.5–4 s). */
export const DURATION: Record<Action | Gesture | Emote, number> = {
  wave: 2.2,
  dance: 4,
  panic: 2.6,
  fly: 3.2,
  vanish: 2.6,
  hiccup: 2.6,
  peekaboo: 3,
  selfie: 3,
  dizzy: 3.4,
  sneeze: 2.8,
  sulk: 3.4,
  deploying: 4,
  think: 2.2,
  point: 2.2,
  thumbs: 1.8,
  cheer: 2.4,
  // idle routines: sleep is one 4 s breath-and-nod cycle, replayed while he naps
  yawn: 2.8,
  sleep: 4,
  wake: 1.4,
}

/**
 * Reduced motion (spec §7.8): a chosen action shows as one still pose held for its duration. The
 * moment of each action that reads best on its own (a raised wave, the peek, the CHOO, mid-typing);
 * vanish holds half-dissolved so there is still something of him to see.
 */
export const KEY_T: Record<Action | Gesture | Emote, number> = {
  wave: 0.6,
  dance: 0.17,
  panic: 0.5,
  fly: 1.6,
  vanish: 0.65,
  hiccup: 0.4,
  peekaboo: 1.27,
  selfie: 1.2,
  dizzy: 2.0,
  sneeze: 1.6,
  sulk: 1.2,
  deploying: 1.2,
  think: 1,
  point: 1,
  thumbs: 0.9,
  cheer: 1,
  yawn: 1.4,
  sleep: 1,
  wake: 0.3,
}

export const hasPose = (k: string): k is PoseKind => k === 'idle' || k === 'drag' || Object.hasOwn(DURATION, k)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** 0 → 1 between a and b, eased. */
const ramp = (t: number, a: number, b: number) => {
  const x = clamp((t - a) / (b - a), 0, 1)
  return x * x * (3 - 2 * x)
}
/** 0 → 1 → 0: up over [a, b], held, down over [c, d]. */
const hold = (t: number, a: number, b: number, c: number, d: number) => ramp(t, a, b) * (1 - ramp(t, c, d))
/** Short spike at `at`, 0 → 1 → 0 over `w` seconds. */
const spike = (t: number, at: number, w: number) => {
  const x = (t - at) / w
  return x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI)
}

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
  if (kind !== 'idle' && kind !== 'drag' && t > DURATION[kind]) return p
  const A = ctx.toward > 0 ? 1 : 0 // arm on the screens' side
  const B = 1 - A
  const side = ctx.toward
  /** shoulder sign per arm: raising arm i means sh[i] → sg[i] × angle */
  const sg = [-1, 1] as const
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
    case 'fly': {
      // Crouch, lift off with one fist up (on the open side), hover, land.
      const air = hold(t, 0.35, 1.0, 2.3, 2.95)
      const up = t > 0.2 && t < 2.5 ? 1 : 0 // step: the runtime damps the swing and folds the elbow
      p.rootY = air * (0.8 + 0.05 * Math.sin(t * 5))
      p.bodyY += -0.07 * spike(t, 0, 0.5) - 0.05 * spike(t, 2.75, 0.4)
      p.sh[A] = sg[A] * (0.14 + up * 2.72) // one straight arm up, superhero style
      p.el[A] = -sg[A] * 0.12 * up
      p.sh[B] = sg[B] * (0.14 + up * 0.26)
      p.el[B] = sg[B] * 0.2 * up
      p.bodyZ = -sg[A] * 0.09 * air
      p.headZ = -sg[A] * 0.06 * air
      p.headX = -0.12 * air
      p.open = air > 0.3
      break
    }
    case 'vanish': {
      // Startle, dither away, reappear with a ta-da.
      p.visible = 1 - hold(t, 0.35, 0.95, 1.55, 2.15)
      const startle = hold(t, 0, 0.2, 0.5, 0.7)
      // ta-da: one arm a beat after the other, so both hands are never at their widest at once
      const tada = [t > 1.75 && t < 2.45 ? 1 : 0, t > 1.9 && t < 2.5 ? 1 : 0]
      p.sh = [-0.14 - 0.35 * startle - 0.45 * tada[0], 0.14 + 0.35 * startle + 0.45 * tada[1]]
      p.el = [-1.9 * tada[0], 1.9 * tada[1]]
      p.wide = startle > 0.3
      p.open = startle > 0.3 || tada[0] > 0
      p.bodyY += 0.06 * tada[0]
      break
    }
    case 'hiccup': {
      // Three hics: a jolt up, shoulders shrug, eyes pop.
      const h = Math.max(spike(t, 0.25, 0.3), spike(t, 1.05, 0.3), spike(t, 1.85, 0.3))
      p.bodyY += 0.16 * h
      p.sh = [-0.14 - 0.4 * h, 0.14 + 0.4 * h]
      p.el = [0.25 * h, -0.25 * h]
      p.headX = -0.14 * h
      p.headZ = 0.05 * Math.sin(t * 3)
      p.wide = h > 0.3
      p.open = h > 0.5
      break
    }
    case 'peekaboo': {
      // Hands over the face, a peek between them, cover again, then BOO.
      const cover = Math.max(hold(t, 0.05, 0.4, 0.95, 1.15), hold(t, 1.4, 1.65, 2.0, 2.15))
      const peek = hold(t, 0.95, 1.15, 1.4, 1.6)
      const boo = hold(t, 2.05, 2.25, 2.65, 2.95)
      const raise = Math.max(cover, peek, boo)
      for (const i of [0, 1] as const) {
        // Arms up across the front (negative of the raise sign) and pitched toward the viewer so the
        // hands meet over the eyes; the peek opens the elbows a little, BOO flings the hands out by the head.
        p.sh[i] = sg[i] * 0.14 * (1 - raise) - sg[i] * raise * (2.9 - 0.3 * peek - 0.3 * boo)
        p.el[i] = sg[i] * 0.3 * cover - sg[i] * (0.9 * peek + 1.4 * boo)
      }
      p.fwd = [raise * (0.75 - 0.4 * boo), raise * (0.75 - 0.4 * boo)]
      // he bows into his hands (they can't reach his eyes otherwise), lifts a little to peek
      p.headX = 0.35 * cover + 0.12 * peek - 0.1 * boo
      p.headY = 0
      p.wide = peek > 0.3 || boo > 0.3
      p.open = boo > 0.3 || peek > 0.5
      p.bodyY += 0.12 * Math.abs(Math.sin(t * 9)) * boo
      break
    }
    case 'selfie': {
      // Phone up and out on the open side, a grin and a thumbs up, one flash.
      const out = t > 0.05 && t < 2.6 ? 1 : 0
      p.sh[A] = sg[A] * (0.14 + out * 2.26)
      p.el[A] = sg[A] * 0.75 * out
      const thumb = t > 0.3 && t < 2.6 ? 1 : 0 // a beat after the phone arm
      p.sh[B] = sg[B] * (0.14 + thumb * 0.56)
      p.el[B] = sg[B] * 1.9 * thumb
      const ph: [number, number] = [0, 0]
      ph[A] = hold(t, 0.15, 0.4, 2.55, 2.8)
      p.phone = ph
      p.headZ = sg[A] * 0.16 * out
      p.headY = sg[A] * 0.2 * out
      p.open = out > 0.5
      p.flash = t >= 1.5 && t < 1.8 ? 1 - (t - 1.5) / 0.3 : 0
      p.wide = t >= 1.5 && t < 1.9
      break
    }
    case 'dizzy': {
      // Two fast spins, then a wobbly, woozy stand.
      p.turn = ramp(t, 0, 1.3) * Math.PI * 4
      const spin = hold(t, 0, 0.25, 1.1, 1.3)
      const woozy = hold(t, 1.2, 1.4, 3.0, 3.35)
      const w = Math.sin((t - 1.2) * 5.5)
      p.sh = [-0.14 - 0.5 * spin - 0.2 * woozy * (1 + w), 0.14 + 0.5 * spin + 0.2 * woozy * (1 - w)]
      p.bodyZ = 0.14 * woozy * w
      p.headZ = -0.22 * woozy * Math.sin((t - 1.2) * 5.5 + 1)
      p.headX = 0.1 * woozy * Math.cos((t - 1.2) * 5.5)
      p.headY = woozy * 0.25 * Math.sin((t - 1.2) * 3)
      p.wide = woozy > 0.3
      p.open = spin > 0.5 || woozy > 0.3
      break
    }
    case 'sneeze': {
      // "Ah… ah…" head tipping back, eyes shut; "CHOO": snap forward; sheepish recovery.
      const wind = hold(t, 0.1, 1.35, 1.4, 1.5)
      const choo = hold(t, 1.42, 1.5, 1.75, 2.1)
      const sorry = hold(t, 2.0, 2.2, 2.5, 2.8)
      p.headX = -0.32 * wind + 0.38 * choo
      p.headZ = 0.1 * sorry
      p.bodyY += 0.05 * wind - 0.1 * choo
      // shoulders creep up on the wind-up; on the CHOO one hand flies to his mouth
      const cover = hold(t, 1.3, 1.45, 2.0, 2.3)
      p.sh = [-0.14 - 0.3 * wind, 0.14 + 0.3 * wind]
      p.sh[B] = sg[B] * (0.14 + 0.3 * wind) * (1 - cover) - sg[B] * 2.75 * cover
      p.el[B] = sg[B] * 0.2 * cover
      const fwd: [number, number] = [-0.3 * choo, -0.3 * choo]
      fwd[B] = 0.85 * cover
      p.fwd = fwd
      p.shut = wind > 0.45 || choo > 0.2
      p.open = wind > 0.3 || choo > 0.2
      break
    }
    case 'sulk': {
      // Turns his back, arms folded, head down; a quick glance back to check you noticed.
      const away = hold(t, 0, 0.45, 2.95, 3.4)
      const glance = hold(t, 1.7, 1.9, 2.3, 2.5)
      p.turn = side * 2.3 * away
      p.headY = -side * 0.9 * glance
      p.headX = 0.32 * away * (1 - glance * 0.6)
      p.bodyY += -0.05 * away
      p.sh = [-0.14 * (1 - away), 0.14 * (1 - away)]
      p.fwd = [-1.4 * away, -1.4 * away]
      p.el = [1.6 * away, -1.6 * away]
      break
    }
    case 'deploying': {
      // Types furiously at a laptop, closes it, then celebrates (his own).
      const typing = hold(t, 0, 0.3, 2.2, 2.4)
      const party = t > 2.35 && t < 3.7 ? 1 : 0 // fists up one after the other, down the same way
      const party1 = t > 2.65 ? 1 : 0 // second fist a beat later (keeps the swing narrow)
      p.laptop = t > 0.05 && t < 2.3 ? 1 : 0
      const k = Math.sin(t * 31)
      p.fwd = [typing * (-1.45 + 0.07 * k), typing * (-1.45 - 0.07 * k)]
      p.sh = [0.2 * typing - 2.6 * party, -0.2 * typing + 2.6 * party1]
      p.el = [
        typing * (0.4 + 0.18 * Math.sin(t * 37)) - 0.5 * party,
        -typing * (0.4 + 0.18 * Math.sin(t * 37 + 1.7)) + 0.5 * party1,
      ]
      p.headX = 0.28 * typing
      p.headY = 0.25 * typing * Math.sin(t * 2.2) * 0.3
      p.headZ = 0.03 * typing * Math.sin(t * 23)
      p.bodyY += 0.015 * typing * k + 0.15 * party * Math.abs(Math.sin(t * 8))
      p.wide = typing > 0.5
      p.open = party > 0.5
      break
    }
    case 'yawn': {
      // Stretches both arms up, head back, a big open-mouthed yawn with his eyes squeezed shut.
      const s = hold(t, 0.2, 0.9, 1.9, 2.6)
      // arms as high as the cheer's (2.6): a full overhead stretch, no wider than his widest poses
      p.sh = [-0.14 - 2.46 * s, 0.14 + 2.46 * s]
      p.el = [-0.5 * s, 0.5 * s]
      p.headX = -0.16 * s
      p.bodyY += 0.04 * s
      p.open = s > 0.3
      p.shut = s > 0.15
      break
    }
    case 'sleep': {
      // Asleep on his feet: eyes shut, head drooped and tilted, slow breathing, one nod per cycle.
      // Periodic over DURATION.sleep (4 s), so replays join up without a jump.
      const breath = Math.sin((t / 4) * Math.PI * 2)
      p.bodyY = 0.035 * breath
      p.headX = 0.3 + 0.12 * spike(t, 2.3, 0.9)
      p.headZ = 0.2 + 0.03 * breath
      p.sh = [-0.06, 0.06]
      p.shut = true
      break
    }
    case 'wake': {
      // Startled awake: a hop, arms flung out, eyes wide, then settles.
      const h = spike(t, 0.05, 0.5)
      const flare = hold(t, 0, 0.12, 0.7, 1.2)
      p.bodyY += 0.2 * h
      p.sh = [-0.14 - 0.85 * flare, 0.14 + 0.85 * flare]
      p.el = [-0.35 * flare, 0.35 * flare]
      p.headZ = 0.06 * Math.sin(t * 18) * flare
      p.wide = t < 1.0
      p.open = t < 0.8
      break
    }
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
