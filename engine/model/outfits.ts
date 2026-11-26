import {
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import type { Object3D } from 'three'
import type { OutfitId } from '../types'
import type { Layer, Rig } from './build'
import { at, createKit, hide, show, type Kit } from './kit'

/** Outfits that put a hat on (it replaces the hair's crown, if the style has one). */
export const HATTED: ReadonlySet<OutfitId> = new Set<OutfitId>(['hardhat', 'detective'])

const BLAZER = '#17181c'
const HARDHAT = '#f2c230'
const HARDHAT_RIDGE = '#c9971c'
const TWEED = '#a07c52'
const WOOD = '#b08a5a'
const RIM = '#2a2a2e'
const LENS = '#e8eef0'
const INK = '#111110'

/**
 * Grip for a held prop (hand space: fingers point -y, the elbow is +y, the thumb on the -side x edge).
 * The handle runs across the fist at FIST_Y, PROP_GRIP up its length from the butt end, so the butt peeks
 * out of the little-finger side and the head comes out of the thumb side, tipped PROP_TILT toward the
 * fingers. Z sits the handle just behind the fingers' front so they read as wrapped around it.
 */
const FIST_Y = -0.12
const PROP_GRIP = 0.2
const PROP_TILT = 0.15
const PROP_Z = -0.02

/** Shows the hair's crown, or hides it under a hat. Called after either layer changes. */
export function fitCrown(rig: Rig): void {
  const crown = rig.layers.hair?.crown
  if (crown) (HATTED.has(rig.look.outfit) ? hide : show)(crown)
}

/**
 * Front of the torso (body coords): capsule radius 0.9, cylinder half-length 0.55 at y = −1.05,
 * scaled (1.3, 1, 0.78). Returns z on the surface at (x, y), lifted by `lift`.
 */
function torsoZ(x: number, y: number, lift: number): number {
  const top = -0.5 // centre of the upper hemisphere
  const r = y > top ? Math.sqrt(Math.max(0, 0.81 - (y - top) ** 2)) : 0.9
  const xl = Math.min(Math.abs(x) / 1.3, r)
  return 0.78 * Math.sqrt(r * r - xl * xl) + lift
}

/** A sheet that follows the torso front: (u, v) ∈ [0,1]² → body (x, y), z from the surface. */
function torsoSheet(f: (u: number, v: number) => [number, number], lift: number, cols = 8, rows = 14): BufferGeometry {
  const pos: number[] = []
  for (let i = 0; i <= rows; i++)
    for (let j = 0; j <= cols; j++) {
      const [x, y] = f(j / cols, i / rows)
      pos.push(x, y, torsoZ(x, y, lift))
    }
  const idx: number[] = []
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j
      const b = a + cols + 1
      idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

type Built = { objects: Object3D[]; undo?: () => void }
type Builder = (rig: Rig, k: Kit) => Built

/**
 * Holds `prop` (built along +y: butt at 0, head at the top) in hand `i` (0: his left, 1: his right),
 * across the fist with the head out of the thumb side. Held across the forearm, a prop stands upright
 * when he points and lies flat when his arm hangs, so it never widens his widest poses or raises his
 * top (tests/unit/bounds.test.ts measures it).
 */
function hold(rig: Rig, i: 0 | 1, prop: Group): Object3D {
  const t = rig.arms[i].side * (Math.PI / 2 + PROP_TILT)
  prop.rotation.z = t
  // put the prop's grip point (0, PROP_GRIP) on the fist
  prop.position.set(Math.sin(t) * PROP_GRIP, FIST_Y - Math.cos(t) * PROP_GRIP, PROP_Z)
  rig.slots.hands[i].add(prop)
  return prop
}

const OUTFITS: Record<OutfitId, Builder> = {
  hoodie: () => ({ objects: [] }),

  /** Napa (spec §6.2): dark blazer over the hoodie, hoodie showing in the V, vermilion bow tie on the collar. */
  'blazer-bowtie'(rig, k) {
    rig.paint.hoodie.forEach((m) => m.color.set(BLAZER))
    rig.drawstrings.forEach(hide)
    const top = 0.3
    const bottom = -0.78
    const half = 0.36
    const v = k.part(
      torsoSheet((u, t) => {
        const y = top + (bottom - top) * t
        return [half * (1 - t) * (2 * u - 1), y]
      }, 0.012),
      rig.look.base.hoodie,
      { outline: false },
    )
    v.name = 'blazer-v'
    // ink edges down the V (the lapels' line) and two buttons below it
    const edges = new Group()
    for (const s of [-1, 1]) {
      edges.add(
        k.flat(
          torsoSheet(
            (u, t) => {
              const y = top + (bottom - top) * t
              // x always grows with u, so both strips face the camera
              return [s * half * (1 - t) + 0.05 * (s > 0 ? u : u - 1), y]
            },
            0.02,
            2,
            14,
          ),
          INK,
        ),
      )
    }
    for (const y of [-0.98, -1.26])
      edges.add(at(k.flat(new SphereGeometry(0.055, 10, 8), INK), 0, y, torsoZ(0, y, 0.02)))
    const bow = at(new Group(), 0, 0, 0)
    bow.name = 'bowtie'
    for (const s of [-1, 1]) {
      const wing = at(k.accent(new CylinderGeometry(0.15, 0.03, 0.27, 14)), s * 0.15, 0, 0)
      wing.rotation.z = -s * (Math.PI / 2)
      wing.scale.set(1, 1, 0.45)
      bow.add(wing)
    }
    const knot = k.accent(new SphereGeometry(0.075, 12, 10))
    knot.scale.set(1, 1.1, 0.8)
    bow.add(knot)
    rig.body.add(v, edges)
    rig.slots.neck.add(bow)
    return {
      objects: [v, edges, bow],
      undo() {
        rig.paint.hoodie.forEach((m) => m.color.set(rig.look.base.hoodie))
        rig.drawstrings.forEach(show)
      },
    }
  },

  /** Bevlytics (spec §6.2): yellow hard hat with a ridge ("pipeline builder"). No hand prop. */
  hardhat(rig, k) {
    const hat = new Group()
    hat.name = 'hardhat'
    const shell = new Group()
    shell.scale.set(1, 0.8, 1.04)
    shell.add(k.part(new SphereGeometry(0.97, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), HARDHAT))
    const ridge = k.part(new TorusGeometry(0.97, 0.085, 8, 36, Math.PI), HARDHAT_RIDGE)
    ridge.rotation.y = Math.PI / 2
    shell.add(ridge)
    hat.add(shell)
    const brim = at(k.part(new CylinderGeometry(1.1, 1.12, 0.07, 40), HARDHAT), 0, 0.02, 0.04)
    brim.scale.set(1, 1, 1.06)
    hat.add(brim)
    rig.slots.hat.add(hat)
    return { objects: [hat] }
  },

  /** Data to Insights (spec §6.2): deerstalker with front and back peaks, and a magnifying glass. */
  detective(rig, k) {
    const hat = new Group()
    hat.name = 'deerstalker'
    const crown = at(k.part(new SphereGeometry(0.95, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), TWEED), 0, -0.02, 0)
    crown.scale.set(1, 0.82, 1.02)
    hat.add(crown)
    for (const s of [-1, 1]) {
      const peak = at(k.part(new SphereGeometry(0.5, 20, 10), TWEED), 0, 0, s * 0.82)
      peak.scale.set(1.2, 0.12, 1.15)
      peak.rotation.x = s * 0.12
      hat.add(peak)
      // ear flaps tied up on top
      const flap = at(k.part(new SphereGeometry(0.15, 12, 10), TWEED), s * 0.17, 0.75, 0)
      flap.scale.set(1.15, 0.5, 0.7)
      hat.add(flap)
    }
    hat.add(at(k.part(new SphereGeometry(0.065, 10, 8), TWEED), 0, 0.78, 0))
    rig.slots.hat.add(hat)

    const glass = new Group()
    glass.name = 'magnifier'
    glass.add(at(k.part(new CylinderGeometry(0.06, 0.07, 0.46, 10), WOOD), 0, 0.18, 0))
    glass.add(at(k.part(new TorusGeometry(0.28, 0.06, 10, 32), RIM), 0, 0.68, 0))
    glass.add(at(k.lit(new CircleGeometry(0.26, 28), LENS), 0, 0.68, 0))
    // his right hand: the one he points with on the Data to Insights side
    return { objects: [hat, hold(rig, 1, glass)] }
  },
}

/**
 * Swaps the outfit layer: undoes the old outfit (paint, drawstrings), frees its geometries and
 * materials, then builds `id` on the slots. Hair keeps its style; a hat hides the hair's crown.
 */
export function applyOutfit(rig: Rig, id: OutfitId): void {
  const old = rig.layers.outfit
  if (old) {
    old.undo?.()
    old.objects.forEach((o) => o.removeFromParent())
    old.kit.dispose()
  }
  const kit = createKit(rig.outline, rig.look.base.skin)
  const built = (OUTFITS[id] ?? OUTFITS.hoodie)(rig, kit)
  const layer: Layer = { id, kit, objects: built.objects, undo: built.undo }
  rig.layers.outfit = layer
  rig.look.outfit = id
  fitCrown(rig)
}
