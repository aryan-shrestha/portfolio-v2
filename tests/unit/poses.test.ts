import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK } from '@/engine/look'
import { buildCharacter } from '@/engine/model/build'
import { applyPose } from '@/engine/pose-rig'
import { DURATION, hasPose, poseFor, type Pose, type PoseCtx, type PoseKind } from '@/engine/poses'
import { CASE_COMMENTS, QUIPS, REACTIONS } from '@/engine/quips'
import type { Action, Gesture } from '@/engine/types'

const ctx: PoseCtx = { now: 0, toward: 1, vx: 0 }

const ACTIONS: Action[] = ['wave', 'dance', 'panic', 'fly', 'vanish', 'hiccup', 'peekaboo', 'selfie', 'dizzy', 'sneeze', 'sulk', 'deploying']
const GESTURES: Gesture[] = ['wave', 'point', 'thumbs', 'think', 'cheer']
const NEW: Action[] = ['fly', 'vanish', 'hiccup', 'peekaboo', 'selfie', 'dizzy', 'sneeze', 'sulk', 'deploying']

/** Samples a timed pose every 1/30 s across its duration. */
function samples(kind: PoseKind, c = ctx): { t: number; p: Pose }[] {
  const out: { t: number; p: Pose }[] = []
  const d = DURATION[kind as Action | Gesture]
  for (let t = 0; t <= d; t += 1 / 30) out.push({ t, p: poseFor(kind, t, c) })
  return out
}

const DT = 1 / 60

describe('poseFor', () => {
  it('idle: arms hang just off the body, smile, breathing bob from ctx.now', () => {
    const p = poseFor('idle', 0, ctx)
    expect(p.sh).toEqual([-0.14, 0.14])
    expect(p.el).toEqual([0, 0])
    expect(p.open).toBe(false)
    expect(p.wide).toBe(false)
    expect(poseFor('idle', 0, { ...ctx, now: Math.PI / 3.2 }).bodyY).toBeCloseTo(0.02)
  })

  it('wave raises the left arm over the head with a waggling elbow', () => {
    const p = poseFor('wave', 0.3, ctx)
    expect(p.sh[0]).toBe(-2.55)
    expect(p.el[0]).toBeCloseTo(-(0.3 + 0.45 * Math.sin(0.3 * 13)))
    expect(p.sh[1]).toBe(0.14)
    expect(p.open).toBe(true)
  })

  it('point and thumbs use the arm on the screens side', () => {
    expect(poseFor('point', 0, { ...ctx, toward: 1 }).sh).toEqual([-0.14, 1.5])
    expect(poseFor('point', 0, { ...ctx, toward: -1 }).sh).toEqual([-1.5, 0.14])
    expect(poseFor('thumbs', 0, { ...ctx, toward: -1 }).sh[0]).toBe(-0.7)
  })

  it('drag flails both arms upward, open-eyed, tilting against the velocity', () => {
    const p = poseFor('drag', 0, { ...ctx, vx: 10 })
    expect(Math.abs(p.sh[0])).toBeGreaterThanOrEqual(2)
    expect(Math.abs(p.sh[1])).toBeGreaterThanOrEqual(2)
    expect(p.wide).toBe(true)
    expect(p.bodyZ).toBeCloseTo(-0.2)
    expect(poseFor('drag', 0, { ...ctx, vx: 100 }).bodyZ).toBe(-0.3)
  })

  it('every action and gesture has a duration of 1.5–4 s', () => {
    expect(Object.keys(DURATION).sort()).toEqual([...new Set([...ACTIONS, ...GESTURES])].sort())
    for (const k of [...ACTIONS, ...GESTURES]) {
      expect(DURATION[k]).toBeGreaterThanOrEqual(1.5)
      expect(DURATION[k]).toBeLessThanOrEqual(4)
    }
  })

  it('every action and gesture is back to idle once its duration is over', () => {
    for (const k of [...ACTIONS, ...GESTURES]) {
      for (const toward of [1, -1] as const) {
        const c = { ...ctx, now: 1.3, toward }
        expect(poseFor(k, DURATION[k] + 0.01, c), k).toEqual(poseFor('idle', DURATION[k] + 0.01, c))
      }
    }
  })

  it('hasPose covers all twelve actions, the five gestures, idle and drag', () => {
    for (const k of [...ACTIONS, ...GESTURES, 'idle', 'drag']) expect(hasPose(k)).toBe(true)
    expect(hasPose('moonwalk')).toBe(false)
  })
})

describe('new actions read as what they are', () => {
  it('fly lifts off, hovers and lands', () => {
    const s = samples('fly')
    expect(s[0].p.rootY ?? 0).toBeLessThan(0.05)
    expect(Math.max(...s.map((x) => x.p.rootY ?? 0))).toBeGreaterThanOrEqual(0.3)
    expect(s.at(-1)!.p.rootY ?? 0).toBeLessThan(0.05)
  })

  it('vanish dithers out to nothing and back', () => {
    const s = samples('vanish')
    expect(s[0].p.visible ?? 1).toBe(1)
    expect(Math.min(...s.map((x) => x.p.visible ?? 1))).toBeLessThanOrEqual(0.02)
    expect(s.at(-1)!.p.visible ?? 1).toBeGreaterThan(0.95)
  })

  it('hiccup jolts up with surprised eyes, more than once', () => {
    const jolts = samples('hiccup').filter((x) => x.p.bodyY > 0.1 && x.p.wide)
    expect(jolts.length).toBeGreaterThan(0)
    const starts = jolts.filter((x, i) => i === 0 || x.t - jolts[i - 1].t > 0.1)
    expect(starts.length).toBeGreaterThanOrEqual(2)
  })

  it('peekaboo covers the face with both hands, then peeks', () => {
    const rig = buildCharacter(DEFAULT_LOOK)
    const covered = (p: Pose) => {
      applyPose(rig, p, Infinity)
      rig.root.updateMatrixWorld(true)
      const face = rig.face.getWorldPosition(new Vector3())
      const skullFront = new Box3().setFromObject(rig.handleParts[0], true).max.z
      return rig.slots.hands.every((h) => {
        const hand = h.parent!.getWorldPosition(new Vector3())
        // over the eyes, and the palm (half-depth 0.12) reaches in front of the face
        return Math.abs(hand.x - face.x) < 0.55 && Math.abs(hand.y - face.y) < 0.4 && hand.z + 0.12 > skullFront
      })
    }
    const s = samples('peekaboo')
    expect(s.some((x) => covered(x.p))).toBe(true)
    expect(s.filter((x) => x.t > 0.5).some((x) => !covered(x.p) && x.p.wide)).toBe(true)
  })

  it('selfie holds a phone out on the screens side and flashes once', () => {
    for (const toward of [1, -1] as const) {
      const s = samples('selfie', { ...ctx, toward })
      const A = toward > 0 ? 1 : 0
      expect(Math.max(...s.map((x) => x.p.phone?.[A] ?? 0))).toBe(1)
      expect(Math.max(...s.map((x) => x.p.phone?.[1 - A] ?? 0))).toBe(0)
      expect(Math.max(...s.map((x) => x.p.flash ?? 0))).toBeGreaterThan(0.5)
      // one flash: the flash value rises from zero exactly once
      const rises = s.filter((x, i) => i > 0 && (s[i - 1].p.flash ?? 0) === 0 && (x.p.flash ?? 0) > 0)
      expect(rises).toHaveLength(1)
    }
  })

  it('dizzy spins at least one full turn, then wobbles', () => {
    const s = samples('dizzy')
    const turns = s.map((x) => x.p.turn ?? 0)
    expect(Math.max(...turns) - Math.min(...turns)).toBeGreaterThanOrEqual(2 * Math.PI)
    expect(s.filter((x) => x.t > DURATION.dizzy * 0.6).some((x) => Math.abs(x.p.bodyZ) > 0.08)).toBe(true)
  })

  it('sneeze winds up (head back, eyes shut) then snaps forward', () => {
    const s = samples('sneeze')
    const back = s.findIndex((x) => x.p.headX < -0.15 && x.p.shut)
    const fwd = s.findIndex((x) => x.p.headX > 0.2)
    expect(back).toBeGreaterThanOrEqual(0)
    expect(fwd).toBeGreaterThan(back)
  })

  it('sulk turns away with the head down', () => {
    const mid = poseFor('sulk', DURATION.sulk / 2, ctx)
    expect(Math.abs(mid.turn ?? 0)).toBeGreaterThanOrEqual(0.8)
    expect(mid.headX).toBeGreaterThan(0.15)
  })

  it('deploying types at a laptop, then celebrates with both arms up', () => {
    const typing = poseFor('deploying', 0.8, ctx)
    expect(typing.laptop).toBe(1)
    const elbows = samples('deploying').filter((x) => x.t < 2).map((x) => x.p.el[0])
    expect(Math.max(...elbows) - Math.min(...elbows)).toBeGreaterThan(0.1) // fast small oscillation
    const party = poseFor('deploying', DURATION.deploying - 0.4, ctx)
    expect(party.laptop ?? 0).toBe(0)
    expect(Math.abs(party.sh[0])).toBeGreaterThanOrEqual(2)
    expect(Math.abs(party.sh[1])).toBeGreaterThanOrEqual(2)
  })
})

describe('new actions stay inside the containment budget (spec §7.5)', () => {
  // Frame by frame at 60 fps from a settled idle, as the runtime damps it (elbows fold mid-swing).
  // Hard budget: total width ≤ 5.75 (phones size to it). Per side, a raise briefly passes ±2.6 the
  // same way the ported wave and cheer do (≈ 3.1 here); the runtime nudges him inward (§7.5.1).
  const settled = (k: Action, t: number) => t > 0.6 && t < DURATION[k] - 0.6
  for (const k of NEW) {
    it(`${k}: width ≤ 5.75, sides ≤ 3.15 in swings, top within 3.05 (+ lift)`, () => {
      for (const toward of [1, -1] as const) {
        const rig = buildCharacter(DEFAULT_LOOK)
        const c = { ...ctx, toward }
        applyPose(rig, poseFor('idle', 0, c), Infinity)
        for (let f = 0; f * DT <= DURATION[k] + 0.5; f++) {
          const t = f * DT
          applyPose(rig, poseFor(k, t, c), DT)
          if (f % 2) continue
          rig.root.updateMatrixWorld(true)
          const b = new Box3().setFromObject(rig.root, true)
          const at = `${k} toward=${toward} t=${t.toFixed(2)}`
          expect(b.max.x - b.min.x, at).toBeLessThanOrEqual(5.75)
          expect(Math.max(-b.min.x, b.max.x), at).toBeLessThanOrEqual(3.15)
          expect(b.max.y, at).toBeLessThanOrEqual(3.05 + Math.max(0, rig.body.position.y))
        }
      }
    })
  }

  it('the held part of every new action stays within ±2.6 once the arms have arrived', () => {
    for (const k of NEW) {
      for (const toward of [1, -1] as const) {
        const rig = buildCharacter(DEFAULT_LOOK)
        for (let t = 0; t <= DURATION[k]; t += 0.05) {
          if (!settled(k, t)) continue
          applyPose(rig, poseFor(k, t, { ...ctx, toward }), Infinity) // arrived: no mid-swing fold
          rig.root.updateMatrixWorld(true)
          const b = new Box3().setFromObject(rig.root, true)
          expect(Math.max(-b.min.x, b.max.x), `${k} toward=${toward} t=${t.toFixed(2)}`).toBeLessThanOrEqual(2.6)
        }
      }
    }
  })
})

describe('quips', () => {
  it('has the hero, outro and copy lines verbatim', () => {
    expect(QUIPS.hero).toBe("Hi, I'm <b>Aryan</b>. Scroll down and I'll show you around.")
    expect(QUIPS.outro).toBe('Got something to build? <b>Say hi.</b>')
    expect(QUIPS.copied).toBe('Copied! Talk soon.')
  })

  it('carries the approved lines from spec §7.4 verbatim', () => {
    expect(QUIPS.poke).toBe('Psst. You can grab me.')
    expect(QUIPS.drag).toBe('Whoa, put me down!')
    expect(QUIPS.drop).toBe('Smooth landing. Mostly.')
    expect(Object.values(REACTIONS)).toContain('Tests passed. Dance break.')
    expect(Object.values(REACTIONS)).toContain('Who pushed to main on a Friday?')
  })

  it('has a short reaction for every action, plus mobile-mode and returning-visitor lines', () => {
    expect(Object.keys(REACTIONS).sort()).toEqual([...ACTIONS].sort())
    for (const line of Object.values(REACTIONS)) {
      expect(line.length).toBeGreaterThan(0)
      expect(line.replace(/<\/?b>/g, '').length).toBeLessThanOrEqual(48)
    }
    expect(QUIPS.mobile.length).toBeGreaterThan(0)
    expect(QUIPS.returning).toMatch(/back/i)
  })

  it('has one comment per case study', () => {
    expect(Object.keys(CASE_COMMENTS).sort()).toEqual(['bevlytics', 'data-to-insights', 'napa-valley-weddings'])
    expect(CASE_COMMENTS.bevlytics).toBe('The data had opinions.')
  })
})
