import {
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  Object3D,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import type { Material, MeshBasicMaterial, MeshLambertMaterial } from 'three'
import type { Look } from '../look'
import { applyHair } from './hair'
import { RIM, at, createKit, hide, type Kit } from './kit'
import { applyOutfit } from './outfits'

export type Arm = { shoulder: Group; elbow: Group; side: -1 | 1 }

/** A swappable layer (hair style, outfit): its own kit, so a swap frees exactly what it replaces. */
export type Layer = {
  id: string
  kit: Kit
  /** top-level objects this layer added, each removed from its parent on swap */
  objects: Object3D[]
  /** hair only: the volume a hat replaces (hidden while a hat is worn) */
  crown?: Object3D
  /** outfit only: undoes what it changed on the base body (paint, hidden drawstrings) */
  undo?: () => void
}

export type Rig = {
  root: Group
  body: Group
  head: Group
  face: Group
  arms: [Arm, Arm]
  eyes: { smile: Group; open: Group }
  mouth: { smile: Mesh; open: Mesh }
  /** Outfit mount points: hat on the face (at the hairline), bow tie at the collar front, a prop per hand. */
  slots: { hat: Group; neck: Group; hands: [Group, Group] }
  /** Action props, scaled to 0 (hidden) until a pose shows them: a phone per hand (selfie), a laptop (deploying). */
  props: { phone: [Group, Group]; laptop: Group }
  bubbleAnchor: Object3D
  /** [skull, torso, hair cap]: the parts the runtime tracks for the grab handle. */
  handleParts: Object3D[]
  /** What it is wearing now (kept in step by applyHair / applyOutfit). */
  look: Look
  /** Swappable layers; null until applied. */
  layers: { hair: Layer | null; outfit: Layer | null }
  /** Hoodie-coloured materials an outfit may repaint (torso, sleeves); hair-coloured brows and moustache. */
  paint: { hoodie: MeshLambertMaterial[]; hair: MeshBasicMaterial[] }
  /** The two drawstring groups (an outfit may hide them). */
  drawstrings: Group[]
  /** Shared ink outline material (owned by the base kit). */
  outline: Material
  /** Frees every geometry and material this rig created, layers included. */
  dispose(): void
}

const STUBBLE = '#b98d6a'
const PROP_DARK = '#2a2a2e'
const PROP_LIGHT = '#c9c4b8'

/** Rim for an open torus arc: thicker by RIM, and longer at both ends so it also edges the arc's ends. */
const arcRim = (r: number, tube: number, segs: number, arc: number) => {
  const d = RIM / r
  return new TorusGeometry(r, tube + RIM, 8, segs + 4, arc + 2 * d).rotateZ(-d)
}

const lambertOf = (g: Group) => (g.children[0] as Mesh).material as MeshLambertMaterial

/** Builds the character (ported from prototype v12), then dresses it: hair style and outfit layers. */
export function buildCharacter(look: Look): Rig {
  const { hairColor, skin, hoodie, glasses } = look.base

  const outline = new ShaderMaterial({
    side: BackSide,
    uniforms: { t: { value: 0.035 } },
    vertexShader: 'uniform float t; void main(){ vec3 p = position + normal * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); }',
  })
  const kit = createKit(outline, skin)
  const { part, feature } = kit
  const hoodiePaint: MeshLambertMaterial[] = []
  const hoodiePart = (g: Group) => (hoodiePaint.push(lambertOf(g)), g)
  const hairPaint: MeshBasicMaterial[] = []
  const hairFlat = (m: Mesh) => (hairPaint.push(m.material as MeshBasicMaterial), m)

  const root = new Group()
  const body = new Group()
  root.add(body)
  const torso = hoodiePart(at(part(new CapsuleGeometry(0.9, 1.1, 8, 32), hoodie), 0, -1.05, 0))
  torso.scale.set(1.3, 1, 0.78)
  body.add(torso)
  const collar = at(part(new TorusGeometry(0.42, 0.17, 14, 36), hoodie), 0, 0.42, -0.05)
  collar.rotation.x = Math.PI / 2
  collar.scale.set(1.08, 1, 1)
  body.add(collar)
  const hoodBack = at(part(new SphereGeometry(0.5, 24, 16), hoodie), 0, 0.5, -0.55)
  hoodBack.scale.set(1.25, 0.9, 0.7)
  body.add(hoodBack)

  // Drawstrings: the accent parts. The outline meshes stay ink.
  const drawstrings: Group[] = []
  for (const s of [-1, 1]) {
    const str = at(new Group(), s * 0.16, 0.08, 0.56)
    str.name = 'drawstring'
    str.add(kit.accent(new CylinderGeometry(0.046, 0.046, 0.5, 8)))
    str.add(at(kit.accent(new CylinderGeometry(0.062, 0.062, 0.11, 8)), 0, -0.29, 0))
    str.rotation.x = -0.28
    str.rotation.z = s * 0.06
    body.add(str)
    drawstrings.push(str)
  }
  const neck = at(part(new CylinderGeometry(0.27, 0.3, 0.5, 20), skin), 0, 0.65, 0)
  body.add(neck)

  const head = at(new Group(), 0, 0.8, 0)
  body.add(head)
  const face = at(new Group(), 0, 0.85, 0)
  head.add(face)
  const skull = part(new SphereGeometry(0.85, 48, 32), skin)
  skull.scale.set(1, 1.08, 0.95)
  face.add(skull)
  for (const s of [-1, 1]) {
    const ear = at(part(new SphereGeometry(0.17, 16, 12), skin), s * 0.84, 0, 0.02)
    ear.scale.set(0.45, 1, 0.75)
    face.add(ear)
  }

  for (const s of [-1, 1]) {
    const brow = at(hairFlat(feature('brow', new CapsuleGeometry(0.03, 0.2, 4, 8), new CapsuleGeometry(0.03 + RIM, 0.2, 4, 8), hairColor)), s * 0.3, 0.27, 0.74)
    brow.rotation.z = Math.PI / 2 + s * 0.12
    brow.rotation.y = s * 0.35
    face.add(brow)
  }
  const eyesSmile = new Group()
  const eyesOpen = new Group()
  face.add(eyesSmile, eyesOpen)
  for (const s of [-1, 1]) {
    const arc = at(feature('eye', new TorusGeometry(0.11, 0.03, 8, 16, Math.PI), arcRim(0.11, 0.03, 16, Math.PI)), s * 0.3, 0.04, 0.77)
    arc.rotation.y = s * 0.35
    eyesSmile.add(arc)
    // rim radius grown so the margin is ≥ RIM after the dot's x/y squash
    const dot = at(feature('eye', new SphereGeometry(0.075, 12, 10), new SphereGeometry(0.075 + RIM / 0.8, 12, 10), undefined, [0.8, 1.1, 0.5]), s * 0.3, 0.06, 0.74)
    eyesOpen.add(dot)
  }
  eyesOpen.visible = false
  const nose = at(part(new SphereGeometry(0.11, 16, 12), skin, { outline: false }), 0, -0.13, 0.8)
  nose.scale.set(1, 0.9, 0.8)
  face.add(nose)
  const noseShadow = at(feature('nose', new CapsuleGeometry(0.018, 0.07, 4, 8), null), 0.03, -0.2, 0.83)
  noseShadow.rotation.z = Math.PI / 2
  face.add(noseShadow)
  for (const s of [-1, 1]) {
    const m = at(hairFlat(feature('moustache', new CapsuleGeometry(0.022, 0.15, 4, 8), null, hairColor)), s * 0.1, -0.26, 0.79)
    m.rotation.z = Math.PI / 2 - s * 0.28
    face.add(m)
  }
  const stubble = at(kit.lit(new SphereGeometry(0.45, 24, 16), STUBBLE), 0, -0.56, 0.46)
  stubble.scale.set(1, 0.55, 0.5)
  face.add(stubble)
  const mouthSmile = at(feature('mouth', new TorusGeometry(0.17, 0.028, 8, 18, Math.PI), arcRim(0.17, 0.028, 18, Math.PI)), 0, -0.36, 0.74)
  mouthSmile.rotation.z = Math.PI
  face.add(mouthSmile)
  // open mouth: a half disc; its rim is a bigger half disc moved up, so it also edges the flat top
  const mouthOpen = at(
    feature('mouth', new CircleGeometry(0.17, 20, Math.PI, Math.PI), new CircleGeometry(0.17 + 2 * RIM, 20, Math.PI, Math.PI).translate(0, RIM, 0)),
    0,
    -0.38,
    0.745,
  )
  mouthOpen.visible = false
  face.add(mouthOpen)

  // Glasses (dress-up option, spec §7.6): round ink rims over the eyes, a bridge, arms back to the ears.
  if (glasses) {
    const specs = new Group()
    specs.name = 'glasses'
    for (const s of [-1, 1]) {
      const lens = at(feature('lens', new TorusGeometry(0.17, 0.028, 8, 28), new TorusGeometry(0.17, 0.028 + RIM, 8, 28)), s * 0.3, 0.05, 0.8)
      lens.rotation.y = s * 0.35
      specs.add(lens)
      const arm = at(feature('temple', new BoxGeometry(0.03, 0.03, 0.62), null), s * 0.74, 0.08, 0.38)
      arm.rotation.y = s * 0.18
      specs.add(arm)
    }
    const bridge = at(feature('bridge', new CapsuleGeometry(0.022, 0.12, 4, 8), new CapsuleGeometry(0.022 + RIM, 0.12, 4, 8)), 0, 0.09, 0.86)
    bridge.rotation.z = Math.PI / 2
    specs.add(bridge)
    face.add(specs)
  }

  const bubbleAnchor = at(new Object3D(), -0.6, 1.45, 0)
  face.add(bubbleAnchor)

  // Outfit mount points. Hat: at the hairline, tipped back a little; neck: in front of the hoodie collar.
  const hat = at(new Group(), 0, 0.5, 0)
  hat.rotation.x = -0.1
  hat.name = 'slot-hat'
  face.add(hat)
  const neckSlot = at(new Group(), 0, 0.43, 0.6)
  neckSlot.name = 'slot-neck'
  body.add(neckSlot)

  const makeArm = (side: -1 | 1): { arm: Arm; handSlot: Group; phone: Group } => {
    const shoulder = at(new Group(), side * 1.0, 0.05, 0)
    body.add(shoulder)
    shoulder.add(hoodiePart(at(part(new CapsuleGeometry(0.27, 0.6, 6, 16), hoodie), 0, -0.45, 0)))
    const elbow = at(new Group(), 0, -0.95, 0)
    shoulder.add(elbow)
    elbow.add(hoodiePart(at(part(new CapsuleGeometry(0.25, 0.5, 6, 16), hoodie), 0, -0.4, 0)))
    const hand = at(new Group(), 0, -0.86, 0.02)
    elbow.add(hand)
    const palm = part(new SphereGeometry(0.22, 18, 14), skin)
    palm.scale.set(1, 1.1, 0.55)
    hand.add(palm)
    ;[-0.13, -0.045, 0.045, 0.13].forEach((x, i) => {
      const f = at(part(new CapsuleGeometry(0.055, 0.15 + (i === 1 || i === 2 ? 0.04 : 0), 4, 8), skin), x, -0.27, 0)
      f.rotation.z = x * 0.8
      hand.add(f)
    })
    const thumb = at(part(new CapsuleGeometry(0.06, 0.12, 4, 8), skin), side * -0.22, -0.04, 0.04)
    thumb.rotation.z = side * -0.9
    hand.add(thumb)
    const handSlot = new Group()
    handSlot.name = 'slot-hand'
    hand.add(handSlot)
    // Selfie phone: held upright in the palm, its back to the camera.
    const phone = at(new Group(), side * -0.04, -0.2, 0.16)
    phone.add(part(new BoxGeometry(0.36, 0.62, 0.07), PROP_DARK))
    hide(phone)
    hand.add(phone)
    return { arm: { shoulder, elbow, side }, handSlot, phone }
  }
  const a0 = makeArm(-1)
  const a1 = makeArm(1)

  // Laptop for "deploying": the back of an open lid in front of his chest, base tucked behind it.
  const laptop = at(new Group(), 0, -0.78, 1.95)
  const lid = part(new BoxGeometry(1.7, 1.05, 0.06), PROP_LIGHT)
  lid.rotation.x = -0.18
  laptop.add(lid)
  const base = at(part(new BoxGeometry(1.7, 0.06, 0.9), PROP_LIGHT), 0, -0.5, -0.45)
  laptop.add(base)
  hide(laptop)
  body.add(laptop)

  const rig: Rig = {
    root,
    body,
    head,
    face,
    arms: [a0.arm, a1.arm],
    eyes: { smile: eyesSmile, open: eyesOpen },
    mouth: { smile: mouthSmile, open: mouthOpen },
    slots: { hat, neck: neckSlot, hands: [a0.handSlot, a1.handSlot] },
    props: { phone: [a0.phone, a1.phone], laptop },
    bubbleAnchor,
    handleParts: [skull, torso, skull],
    look: { base: { ...look.base }, outfit: 'hoodie' },
    layers: { hair: null, outfit: null },
    paint: { hoodie: hoodiePaint, hair: hairPaint },
    drawstrings,
    outline,
    dispose() {
      rig.layers.hair?.kit.dispose()
      rig.layers.outfit?.kit.dispose()
      kit.dispose()
      outline.dispose()
    },
  }
  applyHair(rig, look.base.hair, hairColor)
  applyOutfit(rig, look.outfit)
  return rig
}
