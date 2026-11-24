import { SphereGeometry } from 'three'
import type { BufferGeometry, Group, Object3D } from 'three'
import type { HairStyle } from '../types'

export type PartFactory = (geo: BufferGeometry, color: string, opts?: { outline?: boolean }) => Group
export type At = <T extends Object3D>(o: T, x: number, y: number, z: number) => T

// [x, y, z, radius] from prototype v12
const CURLS = [[-0.55,0.66,0.32,0.3],[-0.2,0.82,0.4,0.32],[0.2,0.84,0.36,0.31],[0.56,0.64,0.28,0.29],[-0.72,0.36,0.08,0.26],[0.74,0.4,0.04,0.26],[-0.36,0.94,-0.06,0.33],[0.26,0.96,-0.1,0.33],[0,0.86,-0.46,0.34],[-0.5,0.62,-0.5,0.3],[0.52,0.62,-0.5,0.3],[0,1.0,0.14,0.3]]
const FRINGE = [[-0.58,0.46,0.5,0.19],[-0.36,0.54,0.6,0.22],[-0.08,0.56,0.64,0.2],[0.2,0.56,0.6,0.17],[0.42,0.6,0.5,0.15]]

/**
 * Hair for the face group. Only 'wavy-fringe' is modelled so far; other styles fall back to it
 * until Task 11 adds them. Returns the cap group (used with skull and torso as the grab handle).
 */
export function buildHair(_style: HairStyle, face: Group, color: string, part: PartFactory, at: At): { cap: Group } {
  const cap = at(part(new SphereGeometry(0.88, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), color), 0, 0.28, -0.02)
  cap.scale.set(1.02, 0.9, 1.02)
  face.add(cap)
  const back = at(part(new SphereGeometry(0.86, 32, 24), color), 0, 0.05, -0.2)
  back.scale.set(1.03, 1, 1)
  face.add(back)
  for (const [x, y, z, r] of CURLS) face.add(at(part(new SphereGeometry(r * 0.8, 20, 14), color), x * 0.92, y * 0.94, z * 0.92))
  for (const [x, y, z, r] of FRINGE) {
    const f = at(part(new SphereGeometry(r, 18, 12), color), x, y, z)
    f.scale.set(1.25, 0.8, 1)
    face.add(f)
  }
  return { cap }
}
