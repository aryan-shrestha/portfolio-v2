import {
  BufferGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  NoBlending,
  Object3D,
  ShaderMaterial,
  BackSide,
  SphereGeometry,
  TorusGeometry,
} from 'three'
import type { Look } from '../look'
import { buildHair } from './hair'
import type { PartFactory } from './hair'

export type Arm = { shoulder: Group; elbow: Group; side: -1 | 1 }

export type Rig = {
  root: Group
  body: Group
  head: Group
  face: Group
  arms: [Arm, Arm]
  eyes: { smile: Group; open: Group }
  mouth: { smile: Mesh; open: Mesh }
  /** Empty mount points for outfits (Task 11). */
  slots: { hat: Group; neck: Group; hands: [Group, Group] }
  bubbleAnchor: Object3D
  /** [skull, torso, hair cap]: the parts the runtime tracks for the grab handle. */
  handleParts: Object3D[]
  /** Frees every geometry and material this rig created. */
  dispose(): void
}

const STRING = '#5f8f5f' // luminance stand-in only; the accent flag (alpha 0.5) selects vermilion, not the colour
const DARK = '#000000'
const STUBBLE = '#b98d6a'

const at = <T extends Object3D>(o: T, x: number, y: number, z: number): T => (o.position.set(x, y, z), o)

/** Builds the character (ported from prototype v12). Only the default hair style is modelled for now. */
export function buildCharacter(look: Look): Rig {
  const { hair, hairColor, skin, hoodie } = look.base
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<{ dispose(): void }>()
  const track = <G extends BufferGeometry>(g: G): G => (geometries.add(g), g)

  const outlineMat = new ShaderMaterial({
    side: BackSide,
    uniforms: { t: { value: 0.035 } },
    vertexShader: 'uniform float t; void main(){ vec3 p = position + normal * t; gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0); }',
    fragmentShader: 'void main(){ gl_FragColor = vec4(0.0,0.0,0.0,1.0); }',
  })
  materials.add(outlineMat)

  const lambert = (color: string, accent = false): MeshLambertMaterial => {
    // Accent flag channel: alpha 0.5. Three only forces alpha to 1 for NormalBlending opaque materials,
    // so NoBlending lets the fragment alpha reach the render target as-is.
    const m = new MeshLambertMaterial(accent ? { color, opacity: 0.5, blending: NoBlending } : { color })
    materials.add(m)
    return m
  }
  const dark = (c?: string): MeshBasicMaterial => {
    const m = new MeshBasicMaterial({ color: c ?? DARK })
    materials.add(m)
    return m
  }
  const part: PartFactory = (geo, color, { outline = true } = {}) => {
    track(geo)
    const g = new Group()
    g.add(new Mesh(geo, lambert(color)))
    if (outline) g.add(new Mesh(geo, outlineMat))
    return g
  }
  const mesh = (geo: BufferGeometry, mat: MeshBasicMaterial | MeshLambertMaterial) => new Mesh(track(geo), mat)

  const root = new Group()
  const body = new Group()
  root.add(body)
  const torso = at(part(new CapsuleGeometry(0.9, 1.1, 8, 32), hoodie), 0, -1.05, 0)
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
  for (const s of [-1, 1]) {
    const str = at(new Group(), s * 0.16, 0.08, 0.56)
    str.name = 'drawstring'
    const accentPart = (geo: BufferGeometry) => {
      track(geo)
      const g = new Group()
      const m = new Mesh(geo, lambert(STRING, true))
      m.userData.accent = true
      g.add(m, new Mesh(geo, outlineMat))
      return g
    }
    str.add(accentPart(new CylinderGeometry(0.046, 0.046, 0.5, 8)))
    str.add(at(accentPart(new CylinderGeometry(0.062, 0.062, 0.11, 8)), 0, -0.29, 0))
    str.rotation.x = -0.28
    str.rotation.z = s * 0.06
    body.add(str)
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

  // Only 'wavy-fringe' exists until Task 11; any other style falls back to it.
  const { cap } = buildHair(hair, face, hairColor, part, at)

  for (const s of [-1, 1]) {
    const brow = at(mesh(new CapsuleGeometry(0.03, 0.2, 4, 8), dark(hairColor)), s * 0.3, 0.27, 0.74)
    brow.rotation.z = Math.PI / 2 + s * 0.12
    brow.rotation.y = s * 0.35
    face.add(brow)
  }
  const eyesSmile = new Group()
  const eyesOpen = new Group()
  face.add(eyesSmile, eyesOpen)
  const eyeMat = dark()
  for (const s of [-1, 1]) {
    const arc = at(mesh(new TorusGeometry(0.11, 0.03, 8, 16, Math.PI), eyeMat), s * 0.3, 0.04, 0.77)
    arc.rotation.y = s * 0.35
    eyesSmile.add(arc)
    const dot = at(mesh(new SphereGeometry(0.075, 12, 10), eyeMat), s * 0.3, 0.06, 0.74)
    dot.scale.set(0.8, 1.1, 0.5)
    eyesOpen.add(dot)
  }
  eyesOpen.visible = false
  const nose = at(part(new SphereGeometry(0.11, 16, 12), skin, { outline: false }), 0, -0.13, 0.8)
  nose.scale.set(1, 0.9, 0.8)
  face.add(nose)
  const noseShadow = at(mesh(new CapsuleGeometry(0.018, 0.07, 4, 8), eyeMat), 0.03, -0.2, 0.83)
  noseShadow.rotation.z = Math.PI / 2
  face.add(noseShadow)
  for (const s of [-1, 1]) {
    const m = at(mesh(new CapsuleGeometry(0.022, 0.15, 4, 8), dark(hairColor)), s * 0.1, -0.26, 0.79)
    m.rotation.z = Math.PI / 2 - s * 0.28
    face.add(m)
  }
  const stubble = at(mesh(new SphereGeometry(0.45, 24, 16), lambert(STUBBLE)), 0, -0.56, 0.46)
  stubble.scale.set(1, 0.55, 0.5)
  face.add(stubble)
  const mouthSmile = at(mesh(new TorusGeometry(0.17, 0.028, 8, 18, Math.PI), eyeMat), 0, -0.36, 0.74)
  mouthSmile.rotation.z = Math.PI
  face.add(mouthSmile)
  const mouthOpen = at(mesh(new CircleGeometry(0.17, 20, Math.PI, Math.PI), eyeMat), 0, -0.38, 0.745)
  mouthOpen.visible = false
  face.add(mouthOpen)

  const bubbleAnchor = at(new Object3D(), -0.6, 1.45, 0)
  face.add(bubbleAnchor)

  // Outfit mount points (empty until Task 11).
  const hat = at(new Group(), 0, 0.85, 0)
  hat.name = 'slot-hat'
  face.add(hat)
  const neckSlot = at(new Group(), 0, 0.42, 0.3)
  neckSlot.name = 'slot-neck'
  body.add(neckSlot)

  const makeArm = (side: -1 | 1): { arm: Arm; handSlot: Group } => {
    const shoulder = at(new Group(), side * 1.0, 0.05, 0)
    body.add(shoulder)
    shoulder.add(at(part(new CapsuleGeometry(0.27, 0.6, 6, 16), hoodie), 0, -0.45, 0))
    const elbow = at(new Group(), 0, -0.95, 0)
    shoulder.add(elbow)
    elbow.add(at(part(new CapsuleGeometry(0.25, 0.5, 6, 16), hoodie), 0, -0.4, 0))
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
    return { arm: { shoulder, elbow, side }, handSlot }
  }
  const a0 = makeArm(-1)
  const a1 = makeArm(1)

  return {
    root,
    body,
    head,
    face,
    arms: [a0.arm, a1.arm],
    eyes: { smile: eyesSmile, open: eyesOpen },
    mouth: { smile: mouthSmile, open: mouthOpen },
    slots: { hat, neck: neckSlot, hands: [a0.handSlot, a1.handSlot] },
    bubbleAnchor,
    handleParts: [skull, torso, cap],
    dispose() {
      geometries.forEach((g) => g.dispose())
      materials.forEach((m) => m.dispose())
    },
  }
}
