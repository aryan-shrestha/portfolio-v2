import { Group, SphereGeometry } from 'three'
import type { Object3D } from 'three'
import type { HairStyle } from '../types'
import type { Layer, Rig } from './build'
import { at, createKit, type Kit } from './kit'
import { fitCrown } from './outfits'

type Built = { cap: Object3D; crown?: Object3D; objects: Object3D[] }
type Builder = (k: Kit, color: string) => Built

// [x, y, z, radius] from prototype v12
const CURLS = [[-0.55,0.66,0.32,0.3],[-0.2,0.82,0.4,0.32],[0.2,0.84,0.36,0.31],[0.56,0.64,0.28,0.29],[-0.72,0.36,0.08,0.26],[0.74,0.4,0.04,0.26],[-0.36,0.94,-0.06,0.33],[0.26,0.96,-0.1,0.33],[0,0.86,-0.46,0.34],[-0.5,0.62,-0.5,0.3],[0.52,0.62,-0.5,0.3],[0,1.0,0.14,0.3]]
const FRINGE = [[-0.58,0.46,0.5,0.19],[-0.36,0.54,0.6,0.22],[-0.08,0.56,0.64,0.2],[0.2,0.56,0.6,0.17],[0.42,0.6,0.5,0.15]]

/** Curls on a ring: `n` of radius `r` at height `y`, `R` from the head's axis, starting at angle `a0`. */
const ring = (n: number, y: number, R: number, r: number, a0 = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2
    return [Math.sin(a) * R, y, Math.cos(a) * R - 0.04, r] as const
  })

/** A cap over the top of the skull, open below `theta`, tipped back so the hairline sits higher in front. */
function cap(k: Kit, color: string, r: number, theta: number, y: number, tilt: number, sy = 1) {
  const c = at(k.part(new SphereGeometry(r, 48, 24, 0, Math.PI * 2, 0, theta), color), 0, y, -0.02)
  c.rotation.x = tilt
  c.scale.set(1.02, sy, 1.0)
  return c
}

const STYLES: Record<HairStyle, Builder> = {
  /** Aryan's own (prototype v12): thick and wavy, volume on top, fringe swept to his right. */
  'wavy-fringe'(k, color) {
    const capPart = at(k.part(new SphereGeometry(0.88, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), color), 0, 0.28, -0.02)
    capPart.scale.set(1.02, 0.9, 1.02)
    const back = at(k.part(new SphereGeometry(0.86, 32, 24), color), 0, 0.05, -0.2)
    back.scale.set(1.03, 1, 1)
    const objects: Object3D[] = [capPart, back]
    for (const [x, y, z, r] of CURLS) objects.push(at(k.part(new SphereGeometry(r * 0.8, 20, 14), color), x * 0.92, y * 0.94, z * 0.92))
    for (const [x, y, z, r] of FRINGE) {
      const f = at(k.part(new SphereGeometry(r, 18, 12), color), x, y, z)
      f.scale.set(1.25, 0.8, 1)
      objects.push(f)
    }
    return { cap: capPart, objects }
  },

  /** Short and tidy: a close cap with a little textured lift along the front. */
  'short-crop'(k, color) {
    const capPart = cap(k, color, 0.9, Math.PI * 0.56, 0.1, -0.3, 1.0)
    const back = at(k.part(new SphereGeometry(0.87, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), color), 0, 0.02, -0.16)
    back.rotation.x = 0.55
    const objects: Object3D[] = [capPart, back]
    for (const [x, y, z, r] of [[-0.42, 0.66, 0.5, 0.17], [-0.14, 0.72, 0.58, 0.19], [0.16, 0.73, 0.57, 0.18], [0.44, 0.67, 0.48, 0.16]]) {
      const t = at(k.part(new SphereGeometry(r, 16, 12), color), x, y, z)
      t.scale.set(1.35, 0.7, 1)
      objects.push(t)
    }
    return { cap: capPart, objects }
  },

  /** Faded sides, a tall mound of curls on top (the mound is what a hat replaces). */
  'curly-top'(k, color) {
    const capPart = cap(k, color, 0.885, Math.PI * 0.5, 0.06, -0.3, 1.04)
    const objects: Object3D[] = [capPart]
    // the low ring frames the face under a hat brim; the mound above it is the crown
    for (const [x, y, z, r] of ring(9, 0.74, 0.6, 0.23, Math.PI / 9)) objects.push(at(k.part(new SphereGeometry(r, 16, 12), color), x, y, z))
    const crown = new Group()
    crown.name = 'crown'
    for (const [x, y, z, r] of [...ring(7, 0.96, 0.44, 0.25), ...ring(3, 1.08, 0.17, 0.24, Math.PI / 3)])
      crown.add(at(k.part(new SphereGeometry(r, 16, 12), color), x, y, z))
    objects.push(crown)
    return { cap: capPart, crown, objects }
  },

  /** Clipped close all over: a thin cap that follows the skull. */
  buzz(k, color) {
    const capPart = cap(k, color, 0.875, Math.PI * 0.52, 0.02, -0.32, 1.08)
    return { cap: capPart, objects: [capPart] }
  },
}

/**
 * Swaps the hair layer: frees the old style's geometries and materials, builds `style` in `color` on
 * the face, and makes its cap the grab handle's hair part. A hat worn now hides the new crown.
 */
export function applyHair(rig: Rig, style: HairStyle, color: string): void {
  const old = rig.layers.hair
  if (old) {
    old.objects.forEach((o) => o.removeFromParent())
    old.kit.dispose()
  }
  const kit = createKit(rig.outline, rig.look.base.skin)
  const built = (STYLES[style] ?? STYLES['wavy-fringe'])(kit, color)
  built.objects.forEach((o) => rig.face.add(o))
  const layer: Layer = { id: style, kit, objects: built.objects, crown: built.crown }
  rig.layers.hair = layer
  rig.handleParts[2] = built.cap
  rig.paint.hair.forEach((m) => m.color.set(color)) // brows and moustache
  rig.look.base.hair = style
  rig.look.base.hairColor = color
  fitCrown(rig)
}
