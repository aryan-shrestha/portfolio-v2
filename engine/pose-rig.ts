import { elbowTarget } from './arms'
import type { Object3D } from 'three'
import type { Rig } from './model/build'
import type { Pose } from './poses'

/** Cursor look and travel from the runtime; tests pass none. Radians. */
export type LookInput = {
  /** head yaw toward the cursor */
  yaw: number
  /** head pitch toward the cursor */
  pitch: number
  /** slow idle head sway */
  sway: number
  /** head turn toward the direction of travel between placements (0 when still) */
  travel: number
  /** eyes mid-blink */
  blink: boolean
}

const NO_LOOK: LookInput = { yaw: 0, pitch: 0, sway: 0, travel: 0, blink: false }
const TAU = Math.PI * 2

/** Exponential approach; dt = Infinity lands exactly on the target. */
const damp = (a: number, b: number, k: number, dt: number) => (dt === Infinity ? b : a + (b - a) * (1 - Math.exp(-k * dt)))
/** Same for an angle, the short way round (a spin that ends on a full turn needs no unwinding). */
const dampAngle = (a: number, b: number, k: number, dt: number) => {
  const d = ((((b - a) % TAU) + TAU + Math.PI) % TAU) - Math.PI
  return damp(a, a + d, k, dt)
}

function showProp(o: Object3D, target: number, dt: number) {
  const s = damp(o.scale.x, target, 18, dt)
  const v = s < 0.02 ? 0 : s
  o.scale.setScalar(v)
  o.visible = v > 0
}

/** Moves the rig toward `pose` over `dt` seconds (spec §7.3–7.5; elbows fold while arms swing, §7.5.3). */
export function applyPose(rig: Rig, pose: Pose, dt: number, look: LookInput = NO_LOOK) {
  const { body, head, arms, eyes, mouth, props } = rig
  const yaw = pose.headY ?? (Math.abs(look.travel) > 0.05 ? look.travel : look.yaw)
  head.rotation.y = damp(head.rotation.y, yaw, 8, dt)
  head.rotation.x = damp(head.rotation.x, pose.headX + look.pitch, 8, dt)
  head.rotation.z = damp(head.rotation.z, pose.headZ + look.sway, 8, dt)
  body.rotation.z = damp(body.rotation.z, pose.bodyZ - look.travel * 0.12, 10, dt)
  body.rotation.y = dampAngle(body.rotation.y, pose.turn ?? 0, 14, dt)
  body.position.y = damp(body.position.y, pose.bodyY + (pose.rootY ?? 0), 12, dt)
  arms.forEach((a, i) => {
    a.shoulder.rotation.z = damp(a.shoulder.rotation.z, pose.sh[i], 12, dt)
    a.shoulder.rotation.x = damp(a.shoulder.rotation.x, pose.fwd?.[i] ?? 0, 12, dt)
    const want = elbowTarget(a.shoulder.rotation.z, pose.sh[i], pose.el[i], a.side)
    a.elbow.rotation.z = damp(a.elbow.rotation.z, want, 18, dt)
  })
  eyes.open.visible = pose.wide
  eyes.smile.visible = !pose.wide
  eyes.open.scale.y = eyes.smile.scale.y = look.blink || pose.shut ? 0.15 : 1
  mouth.open.visible = pose.open
  mouth.smile.visible = !pose.open
  showProp(props.phone[0], pose.phone?.[0] ?? 0, dt)
  showProp(props.phone[1], pose.phone?.[1] ?? 0, dt)
  showProp(props.laptop, pose.laptop ?? 0, dt)
  // An outfit's hand prop (the magnifier) steps aside while that hand holds the phone or types.
  rig.slots.hands.forEach((h, i) => showProp(h, 1 - Math.max(pose.phone?.[i] ?? 0, pose.laptop ?? 0), dt))
}

/** Carries the pose of `from` over to a freshly built `to` (a look change rebuilds the rig mid-motion). */
export function copyPose(from: Rig, to: Rig) {
  const copy = (a: Object3D, b: Object3D) => {
    b.position.copy(a.position)
    b.rotation.copy(a.rotation)
    b.scale.copy(a.scale)
    b.visible = a.visible
  }
  to.root.position.copy(from.root.position)
  to.root.scale.copy(from.root.scale)
  copy(from.body, to.body)
  copy(from.head, to.head)
  from.arms.forEach((a, i) => {
    copy(a.shoulder, to.arms[i].shoulder)
    copy(a.elbow, to.arms[i].elbow)
  })
  copy(from.eyes.smile, to.eyes.smile)
  copy(from.eyes.open, to.eyes.open)
  to.mouth.smile.visible = from.mouth.smile.visible
  to.mouth.open.visible = from.mouth.open.visible
  from.props.phone.forEach((p, i) => copy(p, to.props.phone[i]))
  copy(from.props.laptop, to.props.laptop)
  from.slots.hands.forEach((h, i) => copy(h, to.slots.hands[i]))
}
