import { AmbientLight, Box3, DirectionalLight, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { containShift } from './contain'
import { DEFAULT_LOOK, type Look } from './look'
import { buildCharacter, type Rig } from './model/build'
import { applyOutfit } from './model/outfits'
import {
  IDLE_REACH,
  computePlacements,
  placementAt,
  smootherstep,
  type PlacementState,
  type StageRect,
} from './placement'
import { applyPose, copyPose } from './pose-rig'
import { DURATION, KEY_T, hasPose, poseFor, type Pose, type PoseKind } from './poses'
import { QUIPS } from './quips'
import { createDitherPass } from './render/dither'
import { LIGHTS } from './render/tone'
import { silhouette } from './silhouette'
import { STILL, STILL_S } from './stillFrame'
import type { DebugState, EngineAPI, Gesture, OutfitId, Placement, PlacementKind, PlaceInfo } from './types'

type Section = { el: HTMLElement; kind: PlacementKind; outfit?: OutfitId; gesture?: Gesture; top: number }

const KINDS = new Set<string>(['hero', 'outro', 'left', 'right', 'badge', 'stage'])
const OUTFIT_IDS = new Set<string>(['hoodie', 'blazer-bowtie', 'hardhat', 'detective'])
const GESTURES = new Set<string>(['wave', 'point', 'thumbs', 'think', 'cheer'])
/** Seconds to glide between placements when the sections change (route change, case page → badge). */
const BLEND = 0.6
/** Movement under this many px is a poke, not a drag (spec §7.3). */
const POKE_PX = 6
/** Spring back to the placement: k = 60, c = 11 (prototype v12), integrated in small steps. */
const K = 60
const C = 11
const STEP = 1 / 120

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt))
const stateOf = (p: Placement): PlacementState => ({ ...p, b: p.badge })
const mix = (a: PlacementState, b: PlacementState, t: number, H: number): PlacementState => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  S: lerp(a.S, b.S, t),
  talk: lerp(a.talk, b.talk, t),
  b: lerp(a.b, b.b, t),
  cx: b.cx ?? a.cx,
  cy: b.cy ?? a.cy,
  d: b.d ?? a.d,
  floor: lerp(a.floor ?? -H / 2, b.floor ?? -H / 2, t),
})

/** WebGL 2 (three.js needs it), probed on a throwaway canvas so a failure never reaches three's console errors. */
function hasWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return !!gl
  } catch {
    return false
  }
}

export function createEngine(): EngineAPI {
  let els: {
    canvas: HTMLCanvasElement
    handle: HTMLElement
    bubble: HTMLElement
    badge: HTMLElement
    still: HTMLImageElement
  } | null = null
  /** false without WebGL: the still image only, no interactions (spec §7.7) */
  let gl = true
  let renderer: WebGLRenderer | null = null
  let dither: ReturnType<typeof createDitherPass> | null = null
  let rig: Rig | null = null
  let raf = 0

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 6000)
  camera.position.set(0, 0, 3000)
  const ambient = new AmbientLight(0xffffff, LIGHTS.ambient)
  const key = new DirectionalLight(0xffffff, LIGHTS.key.intensity)
  key.position.set(...LIGHTS.key.dir)
  const fill = new DirectionalLight(0xffffff, LIGHTS.fill.intensity)
  fill.position.set(...LIGHTS.fill.dir)
  scene.add(ambient, key, fill)

  let base: Look['base'] = { ...DEFAULT_LOOK.base }
  let visitorOutfit: OutfitId = DEFAULT_LOOK.outfit

  // layout
  let W = 0
  let H = 0
  let PX = 3
  let P: Record<PlacementKind, Placement> = computePlacements(1, 1)
  let sections: Section[] = []
  let topsDirty = false
  /** the dress-up stage area (window px), when a section is a stage */
  let stageRect: StageRect | undefined

  // placement + choreography
  let shown: PlacementState | null = null
  let blendFrom: PlacementState | null = null
  let blendT = 0
  let current = -1
  let lastSection: number | null = null
  let reduced = false
  let action: PoseKind | null = null
  let actionT = 0
  /** how he is shown now (DebugState.view) */
  let view: DebugState['view'] = 'live'
  /** still mode: what the last still layout was made for; it is redone only when this changes */
  let stillKey = ''
  /** bumps on every rebuild of the rig (a look change), so still mode redraws */
  let rigVersion = 0
  /** tests: read the canvas edge dots back after each drawn frame */
  let probe = false
  let edge: [number, number, number] = [0, 0, 0]
  let greeting: string = QUIPS.hero

  // motion
  const offset = { x: 0, y: 0 }
  const vel = { x: 0, y: 0 }
  const drag = { active: false, px: 0, py: 0, ox: 0, oy: 0, moved: 0, vx: 0 }
  const pointer = { x: 0, y: 0 }
  let last = 0
  let blinkAt = 2
  let prevX: number | null = null
  let travel = 0

  // speech
  let sayText: string | null = null
  let sayUntil = 0
  let bubbleHTML = ''
  let bubbleShown = false
  let bw = 0
  let bh = 0

  const pokes = new Set<() => void>()
  const places = new Set<(p: PlaceInfo) => void>()
  let place: PlaceInfo | null = null
  const sil = new Box3()
  const hb = new Box3()
  const tmp = new Box3()
  const v = new Vector3()
  /** Last value written per element and property: skip identical DOM writes every frame. */
  const styleCache = new Map<HTMLElement, Record<string, string>>()
  type Prop = 'transform' | 'width' | 'height' | 'opacity' | 'left' | 'top' | 'clipPath'
  const setStyle = (el: HTMLElement, prop: Prop, value: string) => {
    let c = styleCache.get(el)
    if (!c) styleCache.set(el, (c = {}))
    if (c[prop] === value) return
    c[prop] = value
    el.style[prop] = value
  }
  const hiddenCache = new Map<HTMLElement, boolean>()
  const setHidden = (el: HTMLElement, hidden: boolean) => {
    if (hiddenCache.get(el) === hidden) return
    hiddenCache.set(el, hidden)
    el.hidden = hidden
  }

  const kindNow = (): PlacementKind => (current >= 0 && sections[current] ? sections[current].kind : 'hero')
  /**
   * The one rule for what he wears (spec §6.2, §7.6): inside a project chapter, that chapter's outfit;
   * anywhere else, the visitor's. `current` flips at the slide's midpoint (p > 0.5), so the swap happens
   * mid-slide on the way in and on the way out, never at a section edge. Base traits are always the visitor's.
   */
  const wornOutfit = (): OutfitId => (current >= 0 ? sections[current]?.outfit : undefined) ?? visitorOutfit
  const clock = () => performance.now() / 1000

  /** (Re)builds the model in the current look; a rebuild picks up the old rig's pose so nothing jumps. */
  function buildRig() {
    const next = buildCharacter({ base, outfit: wornOutfit() })
    if (rig) {
      copyPose(rig, next)
      scene.remove(rig.root)
      rig.dispose()
    }
    rig = next
    scene.add(rig.root)
    rigVersion++
  }

  /** Placements (needs the copy blocks on phones) and section tops. Cheap: no GPU work. */
  function relayout() {
    const mobile = W <= 900
    let copyBottom: number | undefined
    stageRect = undefined
    for (const s of sections) {
      if (s.kind !== 'stage') continue
      // the area kept free for him (dress-up: [data-stage]; else the section itself), in window px
      const r = (s.el.querySelector('[data-stage]') ?? s.el).getBoundingClientRect()
      stageRect = { left: r.left, top: r.top, right: r.right, bottom: Math.min(H, r.bottom) }
    }
    if (mobile) {
      for (const s of sections) {
        if (s.kind !== 'hero' && s.kind !== 'outro') continue
        const copy = s.el.querySelector('[data-copy]')
        if (copy) copyBottom = Math.max(copyBottom ?? 0, copy.getBoundingClientRect().bottom - s.el.getBoundingClientRect().top)
      }
    }
    // With WebGL the "Play with me" pill stands beside him (none in the no-WebGL still mode).
    P = computePlacements(W, H, { copyBottom, stage: stageRect, pill: gl })
    for (const s of sections) s.top = s.el.getBoundingClientRect().top + window.scrollY
    topsDirty = false
    // Case pages reserve a gutter of 0.85 × hero S × 3.5 (spec §6.6).
    document.documentElement.style.setProperty('--char-s', `${P.hero.S.toFixed(2)}px`)
  }

  function resize() {
    if (!els) return
    W = document.documentElement.clientWidth || window.innerWidth
    H = window.innerHeight
    PX = W < 600 ? 2 : 3
    dither?.resize(W, H, PX)
    const rw = Math.max(2, Math.ceil(W / PX))
    const rh = Math.max(2, Math.ceil(H / PX))
    // One dot = PX CSS px exactly: the camera spans the whole dot grid, origin at the window centre.
    camera.left = -W / 2
    camera.right = -W / 2 + rw * PX
    camera.top = H / 2
    camera.bottom = H / 2 - rh * PX
    camera.updateProjectionMatrix()
    els.canvas.style.width = `${rw * PX}px`
    els.canvas.style.height = `${rh * PX}px`
    prevX = null
    bubbleHTML = '' // re-measure the bubble at the new size
    relayout()
  }

  function start(k: PoseKind) {
    action = k
    actionT = 0
  }

  function say(text: string, ms = 3000) {
    sayText = text || null
    sayUntil = clock() + ms / 1000
  }

  /** Tells listeners where he settles (the resting silhouette of the current placement), on change only. */
  function notifyPlace(kind: PlacementKind, shown = true) {
    const p = P[kind]
    const badge = kind === 'badge' && p.d !== undefined && p.cx !== undefined
    const left = badge ? W / 2 + p.cx! - p.d! / 2 : W / 2 + p.x - IDLE_REACH * p.S
    const right = badge ? W / 2 + p.cx! + p.d! / 2 : W / 2 + p.x + IDLE_REACH * p.S
    const lift = p.floor === undefined ? 0 : Math.max(0, H / 2 + p.floor)
    const area: [number, number] = kind === 'stage' && stageRect ? [stageRect.left, stageRect.right] : [0, W]
    if (
      place &&
      place.kind === kind &&
      place.shown === shown &&
      Math.abs(place.left - left) < 1 &&
      Math.abs(place.right - right) < 1 &&
      Math.abs(place.lift - lift) < 1 &&
      Math.abs(place.area[1] - area[1]) < 1
    )
      return
    place = { kind, left, right, lift, area, W, H, shown }
    places.forEach((cb) => cb(place!))
  }

  /** Where he should be this frame: scroll-scrubbed (spec §6.1). */
  function target(): PlacementState {
    if (sections.length === 0) {
      current = -1
      return stateOf(P.hero)
    }
    const r = placementAt(window.scrollY, H, sections, P)
    current = r.current
    return r.st
  }

  /** Containment on the final pose (spec §7.5.1): shift him inward off the left, right and top edges. */
  function contain(S: number) {
    const root = rig!.root
    silhouette(root, sil)
    const { dx, dy } = containShift({ minX: sil.min.x, maxX: sil.max.x, maxY: sil.max.y }, W, H, 0.06 * S + 2 * PX)
    if (dx) {
      offset.x += dx
      root.position.x += dx
      vel.x = 0
    }
    if (dy) {
      offset.y += dy
      root.position.y += dy
      vel.y = 0
    }
  }

  /** Tests (debugProbe): opaque dots in the edge column/row of the frame just drawn, before it is shown. */
  function probeEdges(flash: number) {
    if (!probe || !renderer) return
    if (flash > 0) {
      edge = [0, 0, 0] // the selfie flash lights the whole window on purpose
      return
    }
    const ctx = renderer.getContext()
    const rw = Math.max(2, Math.ceil(W / PX))
    const rh = Math.max(2, Math.ceil(H / PX))
    const count = (x: number, y: number, w: number, h: number) => {
      const buf = new Uint8Array(w * h * 4)
      ctx.readPixels(x, y, w, h, ctx.RGBA, ctx.UNSIGNED_BYTE, buf)
      let n = 0
      for (let i = 3; i < buf.length; i += 4) if (buf[i] > 0) n++
      return n
    }
    // the canvas spans the dot grid from the window's top-left; GL rows count up from the bottom
    edge = [count(0, 0, 1, rh), count(Math.floor((W - 1) / PX), 0, 1, rh), count(0, rh - 1, rw, 1)]
  }

  /** The grab handle over skull + torso + hair, on screen; only as big as the badge once he is one. */
  function placeHandle(badge: { cx: number; cy: number; d: number } | null, on: boolean) {
    const r = rig!
    if (!on) {
      setStyle(els!.handle, 'width', '0px')
      setStyle(els!.handle, 'height', '0px')
      return
    }
    hb.makeEmpty()
    for (const p of r.handleParts) hb.union(tmp.setFromObject(p))
    let x0 = W / 2 + hb.min.x
    let x1 = W / 2 + hb.max.x
    let y0 = Math.max(0, H / 2 - hb.max.y)
    let y1 = Math.min(H, H / 2 - hb.min.y)
    if (badge) {
      const { cx, cy, d } = badge
      x0 = Math.max(x0, W / 2 + cx - d / 2)
      x1 = Math.min(x1, W / 2 + cx + d / 2)
      y0 = Math.max(y0, H / 2 - cy - d / 2)
      y1 = Math.min(y1, H / 2 - cy + d / 2)
    }
    setStyle(els!.handle, 'transform', `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`)
    setStyle(els!.handle, 'width', `${Math.max(0, x1 - x0).toFixed(1)}px`)
    setStyle(els!.handle, 'height', `${Math.max(0, y1 - y0).toFixed(1)}px`)
  }

  /** The white disc with the vermilion ring behind the badge. */
  function placeBadge(opacity: number, cx: number, cy: number, d: number) {
    setStyle(els!.badge, 'opacity', opacity > 0 ? opacity.toFixed(3) : '0')
    if (opacity <= 0) return
    setStyle(els!.badge, 'width', `${d}px`)
    setStyle(els!.badge, 'height', `${d}px`)
    setStyle(els!.badge, 'transform', `translate(${W / 2 + cx - d / 2}px, ${H / 2 - cy - d / 2}px)`)
  }

  /** Bubble: a said line wins; otherwise the hero/outro greeting while he talks there. Anchored above-left of his head. */
  function placeBubble(now: number, talk: number, kind: PlacementKind, shown: boolean) {
    const b = els!.bubble
    if (sayText && now >= sayUntil) sayText = null
    const text = shown ? (sayText ?? (talk > 0.97 ? (kind === 'outro' ? QUIPS.outro : greeting) : null)) : null
    if (text && text !== bubbleHTML) {
      b.innerHTML = text
      bubbleHTML = text
      bw = b.offsetWidth
      bh = b.offsetHeight
    }
    if (!!text !== bubbleShown) {
      bubbleShown = !!text
      b.setAttribute('aria-hidden', String(!bubbleShown))
    }
    setStyle(b, 'opacity', text ? '1' : '0')
    rig!.bubbleAnchor.getWorldPosition(v)
    setStyle(b, 'left', `${clamp(W / 2 + v.x, bw + 8, W - 8).toFixed(1)}px`)
    setStyle(b, 'top', `${clamp(H / 2 - v.y, bh + 8, H - 8).toFixed(1)}px`)
  }

  /** Where the still image goes for a placement: the placement itself; on a stage, its frame bottom on the floor. */
  function imagePlacement(kind: PlacementKind): Placement {
    const p = P[kind]
    return kind === 'stage' ? { ...p, y: (p.floor ?? -H / 2) - STILL.y0 * p.S } : p
  }

  /** Lays still.png over a placement (same maths as the model: screen = origin + model × S); circular clip as the badge. */
  function placeStill(p: Placement, badge: boolean) {
    const img = els!.still
    const left = W / 2 + p.x + STILL.x0 * p.S
    const top = H / 2 - (p.y + STILL.y1 * p.S)
    setStyle(img, 'width', `${((STILL.x1 - STILL.x0) * p.S).toFixed(2)}px`)
    setStyle(img, 'transform', `translate(${left.toFixed(2)}px, ${top.toFixed(2)}px)`)
    setStyle(
      img,
      'clipPath',
      badge && p.d !== undefined && p.cx !== undefined && p.cy !== undefined
        ? `circle(${(p.d / 2 - 3).toFixed(1)}px at ${(W / 2 + p.cx - left).toFixed(1)}px ${(H / 2 - p.cy - top).toFixed(1)}px)`
        : 'none',
    )
  }

  /**
   * Still mode (spec §7.7–7.8): reduced motion, or no WebGL. No scroll choreography and no idle motion:
   * he stands at the hero and outro, is the badge in All work and on case pages, stands on the dress-up
   * stage, and is absent from About and the chapters (nothing over reading text); the section in view
   * swaps him, never a glide. With WebGL (reduced motion) he is one canvas frame in the visitor's own look
   * (ruling R17, spec §7.6), redrawn only on a change; an action chosen from the menu is one frame of its
   * key pose, held for its duration. Without WebGL he is still.png (Aryan's own look), with no interactions.
   */
  function tickStill(now: number, dt: number) {
    const r = rig!
    if (sections.length) current = placementAt(window.scrollY, H, sections, P).current
    else current = -1
    const kind = kindNow()
    const shown = kind !== 'left' && kind !== 'right'
    if (action) {
      actionT += dt
      if (!gl || !shown || action === 'idle' || action === 'drag' || actionT > DURATION[action]) action = null
    }
    const frame = gl && shown
    view = !shown ? 'hidden' : frame ? 'frame' : 'image'
    const p = frame ? P[kind] : imagePlacement(kind)
    const worn = wornOutfit()
    const key = `${view}|${kind}|${action}|${W}x${H}|${PX}|${rigVersion}|${worn}|${p.x.toFixed(1)}|${p.y.toFixed(1)}|${p.S.toFixed(3)}|${p.floor ?? ''}`
    if (key !== stillKey) {
      stillKey = key
      if (r.look.outfit !== worn) applyOutfit(r, worn)
      offset.x = offset.y = vel.x = vel.y = 0
      r.root.scale.setScalar(p.S)
      r.root.position.set(p.x, p.y, 0)
      const pose = poseFor(action ?? 'idle', action ? KEY_T[action] : 0, { now: 0, toward: p.x > 1 ? -1 : 1, vx: 0 })
      applyPose(r, pose, Infinity) // held: straight to the pose, no swing
      if (kind !== 'badge') contain(p.S)
      r.root.updateMatrixWorld(true)
      const badge = kind === 'badge' && p.d !== undefined ? { cx: p.cx ?? 0, cy: p.cy ?? 0, d: p.d } : null
      if (renderer && dither) {
        if (frame) {
          const clip = badge ? { cx: badge.cx, cy: badge.cy, r: badge.d / 2 - 3 } : undefined
          dither.render(scene, camera, { px: PX, clip, floor: p.floor, fade: pose.visible ?? 1, flash: 0 })
          probeEdges(0)
        } else {
          renderer.setRenderTarget(null)
          renderer.clear() // shown once, then nothing is drawn until the next change
          edge = [0, 0, 0]
        }
      }
      setHidden(els!.still, view !== 'image')
      if (view === 'image') placeStill(p, !!badge)
      placeBadge(badge && shown ? 1 : 0, badge?.cx ?? 0, badge?.cy ?? 0, badge?.d ?? 0)
      // pokes open the menu (WebGL only); no carrying him around
      placeHandle(badge, gl && shown)
      notifyPlace(kind, shown)
    }
    placeBubble(now, shown ? p.talk : 0, kind, shown)
  }

  function tick() {
    raf = requestAnimationFrame(tick)
    if (!rig || !els) return
    const now = clock()
    // Real elapsed time (spring sub-stepped) so slow frames don't slow him down; capped for tab returns.
    const dt = Math.min(0.1, now - last)
    last = now
    if (topsDirty) relayout()
    if (reduced || !gl || !dither) {
      shown = null // no glide out of still mode
      blendFrom = null
      return tickStill(now, dt)
    }
    if (view !== 'live') {
      view = 'live'
      stillKey = ''
      lastSection = current // no gesture for the section he is already in
    }
    setHidden(els.still, true)

    let st = target()
    if (blendFrom) {
      blendT += dt
      st = mix(blendFrom, st, smootherstep(Math.min(1, blendT / BLEND)), H)
      if (blendT >= BLEND) blendFrom = null
    }
    shown = st
    const kind = kindNow()

    // Section gestures: once the glide has settled, play the destination's gesture on each change
    // (a jump past several sections plays only the destination's).
    if (!blendFrom && current !== lastSection) {
      const g = current >= 0 ? sections[current].gesture : undefined
      if (g) start(g)
      lastSection = current
    }
    // What he wears: swapped (old layer freed) only when the resolved outfit changes.
    const worn = wornOutfit()
    if (rig.look.outfit !== worn) applyOutfit(rig, worn)

    if (action) {
      actionT += dt
      if (action === 'idle' || action === 'drag' || actionT > DURATION[action]) action = null
    }
    // The carried pose starts only once the press has travelled POKE_PX: a tap (a poke) never flails (R13).
    const carried = drag.active && drag.moved >= POKE_PX
    const pose: Pose = poseFor(carried ? 'drag' : (action ?? 'idle'), actionT, {
      now,
      // toward the open side of the page (the screens in chapters): away from his own side
      toward: P[kind].x > 1 ? -1 : 1,
      vx: drag.vx,
    })
    notifyPlace(kind)
    if (!drag.active) {
      for (let left = dt; left > 1e-6; left -= STEP) {
        const h = Math.min(STEP, left)
        vel.x += (-offset.x * K - vel.x * C) * h
        vel.y += (-offset.y * K - vel.y * C) * h
        offset.x += vel.x * h
        offset.y += vel.y * h
      }
    }
    drag.vx *= 0.85

    const { root, face } = rig
    root.scale.setScalar(st.S)
    root.position.set(st.x + offset.x, st.y + offset.y, 0)

    // Head: follows the cursor; while sliding between placements it turns toward travel.
    const travelV = prevX === null ? 0 : (st.x - prevX) / Math.max(dt, 1e-3)
    prevX = st.x
    travel = damp(travel, clamp(travelV / 900, -0.7, 0.7), 6, dt)
    root.updateMatrixWorld(true)
    face.getWorldPosition(v)
    blinkAt -= dt
    if (blinkAt < -0.12) blinkAt = 2 + Math.random() * 3
    applyPose(rig, pose, dt, {
      yaw: clamp(((pointer.x - (W / 2 + v.x)) / W) * 1.1, -0.5, 0.5),
      pitch: clamp(((pointer.y - (H / 2 - v.y)) / H) * 0.8, -0.3, 0.3),
      sway: Math.sin(now * 0.9) * 0.03,
      travel,
      blink: blinkAt < 0,
    })

    // Containment on this frame's final pose (spec §7.5.1), not while he is the badge.
    if (st.b <= 0.01) contain(st.S)
    root.updateMatrixWorld(true)

    // Badge: white disc with a vermilion ring; the clip closes in as he shrinks.
    const d = st.d ?? 0
    const cx = st.cx ?? 0
    const cy = st.cy ?? 0
    const inBadge = st.b > 0.001 && st.d !== undefined
    placeBadge(inBadge && st.b > 0.6 ? (st.b - 0.6) / 0.4 : 0, cx, cy, d)
    const clip = inBadge ? { cx, cy, r: lerp(Math.hypot(W, H), d / 2 - 3, st.b) } : undefined
    placeHandle(inBadge && st.b > 0.5 ? { cx, cy, d } : null, true)
    placeBubble(now, st.talk, kind, true)

    dither.render(scene, camera, {
      px: PX,
      clip,
      floor: st.floor,
      fade: pose.visible ?? 1,
      flash: pose.flash ?? 0,
    })
    probeEdges(pose.flash ?? 0)
  }

  function run() {
    if (raf || !rig) return
    last = clock()
    raf = requestAnimationFrame(tick)
  }
  function halt() {
    cancelAnimationFrame(raf)
    raf = 0
  }

  // listeners
  const onResize = () => resize()
  const onPointer = (e: PointerEvent) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
  }
  const onVisibility = () => (document.hidden ? halt() : run())
  const motionQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const onMotion = () => {
    reduced = !!motionQuery?.matches
  }
  /** Still mode: he is a picture (reduced motion, or no WebGL); a press can only poke him. */
  const isStill = () => reduced || !gl
  const onDown = (e: PointerEvent) => {
    // Primary pointer, left button only (R11): a second finger or a right-click is not a grab.
    if (!e.isPrimary || e.button !== 0 || drag.active || !gl) return
    Object.assign(drag, { active: true, px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y, moved: 0, vx: 0 })
    vel.x = vel.y = 0
    els?.handle.setPointerCapture(e.pointerId)
    document.body.classList.add('char-dragging')
    e.preventDefault()
  }
  const onMove = (e: PointerEvent) => {
    if (!drag.active || !e.isPrimary) return
    if (isStill()) {
      // reduced motion: no carrying him (no motion he did not ask for); travel only decides poke vs. not
      drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.px, e.clientY - drag.py))
      return
    }
    const prev = offset.x
    offset.x = drag.ox + (e.clientX - drag.px)
    offset.y = drag.oy - (e.clientY - drag.py)
    drag.vx = offset.x - prev
    const was = drag.moved
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.px, e.clientY - drag.py))
    if (was < POKE_PX && drag.moved >= POKE_PX) say(QUIPS.drag, 60_000)
  }
  /** Ends a drag. Only a real release (pointerup) can count as a poke; a cancel or lost capture cannot. */
  const release = (poke: boolean) => {
    if (!drag.active) return
    drag.active = false
    document.body.classList.remove('char-dragging')
    if (drag.moved >= POKE_PX) {
      if (!isStill()) say(QUIPS.drop, 2000)
    } else if (poke) pokes.forEach((cb) => cb())
  }
  const onUp = (e: PointerEvent) => {
    if (e.isPrimary) release(true)
  }
  const onCancel = () => release(false)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (topsDirty = true)) : null

  return {
    mount(canvas, handle, bubble, badge, still) {
      if (els) return gl
      gl = hasWebGL2()
      if (gl) {
        try {
          renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
          dither = createDitherPass(renderer)
        } catch {
          renderer?.dispose()
          renderer = null
          gl = false
        }
      }
      els = { canvas, handle, bubble, badge, still }
      buildRig()
      pointer.x = window.innerWidth * 0.3
      pointer.y = window.innerHeight * 0.4
      onMotion()
      resize()
      window.addEventListener('resize', onResize)
      window.addEventListener('pointermove', onPointer, { passive: true })
      document.addEventListener('visibilitychange', onVisibility)
      motionQuery?.addEventListener('change', onMotion)
      handle.addEventListener('pointerdown', onDown)
      handle.addEventListener('pointermove', onMove)
      handle.addEventListener('pointerup', onUp)
      handle.addEventListener('pointercancel', onCancel)
      handle.addEventListener('lostpointercapture', onCancel)
      ro?.observe(document.body)
      if (!document.hidden) run()
      return gl
    },

    setSections(list) {
      const hadSections = sections.length > 0
      sections = list.flatMap((el) => {
        const { place, outfit: o, gesture: g } = el.dataset
        if (!place || !KINDS.has(place)) return []
        return [
          {
            el,
            kind: place as PlacementKind,
            outfit: o && OUTFIT_IDS.has(o) ? (o as OutfitId) : undefined,
            gesture: g && GESTURES.has(g) ? (g as Gesture) : undefined,
            top: 0,
          },
        ]
      })
      if (els) relayout()
      // Glide from where he is (no re-entry animation, spec §5); fire the destination's gesture once settled.
      if (shown && hadSections) {
        blendFrom = shown
        blendT = 0
      }
      lastSection = null
    },

    play(a) {
      if (hasPose(a)) start(a)
    },
    gesture(g) {
      if (hasPose(g)) start(g)
    },
    say,
    setGreeting(html) {
      greeting = html
    },

    setLook(next) {
      const same = (Object.keys(next) as (keyof Look['base'])[]).every((k) => next[k] === base[k])
      if (same) return
      base = { ...next }
      if (rig) buildRig()
    },
    setOutfit(id) {
      visitorOutfit = id // the next frame resolves what he wears (wornOutfit)
    },

    onPoke(cb) {
      pokes.add(cb)
      return () => void pokes.delete(cb)
    },

    onPlace(cb) {
      places.add(cb)
      if (place) cb(place)
      return () => void places.delete(cb)
    },

    debugState() {
      const a = action === 'idle' || action === 'drag' ? null : action
      const geometries = renderer?.info.memory.geometries ?? 0
      const common = { placement: kindNow(), action: a, geometries, view, edge: [...edge] as [number, number, number] }
      if (!rig) return { minX: 0, maxX: 0, top: 0, S: 0, outfit: wornOutfit(), ...common }
      silhouette(rig.root, sil)
      return {
        minX: W / 2 + sil.min.x,
        maxX: W / 2 + sil.max.x,
        top: H / 2 - sil.max.y,
        S: rig.root.scale.x,
        outfit: rig.look.outfit,
        ...common,
      }
    },

    debugProbe(on) {
      probe = on
      if (!on) edge = [0, 0, 0]
      stillKey = '' // still mode: redraw (and read back) now
    },

    debugStill(kind = 'idle') {
      if (!renderer || !dither || !rig || !els) return null
      // The frame on the dot grid: 3 CSS px per dot, its top-left on a dot corner, centred in the window.
      if (PX !== 3 || W < STILL.w || H < STILL.h) return null
      const L = Math.floor((W - STILL.w) / 2 / PX) * PX
      const T = Math.floor((H - STILL.h) / 2 / PX) * PX
      const r = rig
      r.root.scale.setScalar(STILL_S)
      r.root.position.set(L - W / 2 - STILL.x0 * STILL_S, H / 2 - T - STILL.y1 * STILL_S, 0)
      const pose = poseFor(kind, kind === 'idle' ? 0 : KEY_T[kind], { now: 0, toward: 1, vx: 0 })
      applyPose(r, pose, Infinity)
      r.root.updateMatrixWorld(true)
      dither.render(scene, camera, { px: PX, fade: pose.visible ?? 1 })
      // read in the same task as the draw: the drawing buffer is still intact
      const png = els.canvas.toDataURL('image/png')
      stillKey = ''
      return { png, x: L / PX, y: T / PX, w: STILL.w / PX, h: STILL.h / PX }
    },

    destroy() {
      halt()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointer)
      document.removeEventListener('visibilitychange', onVisibility)
      motionQuery?.removeEventListener('change', onMotion)
      ro?.disconnect()
      if (els) {
        const { handle, bubble, badge } = els
        handle.removeEventListener('pointerdown', onDown)
        handle.removeEventListener('pointermove', onMove)
        handle.removeEventListener('pointerup', onUp)
        handle.removeEventListener('pointercancel', onCancel)
        handle.removeEventListener('lostpointercapture', onCancel)
        handle.style.width = handle.style.height = '0px'
        bubble.style.opacity = badge.style.opacity = '0'
        bubble.setAttribute('aria-hidden', 'true')
        els.still.hidden = true
        document.body.classList.remove('char-dragging')
        document.documentElement.style.removeProperty('--char-s')
      }
      if (rig) {
        scene.remove(rig.root)
        rig.dispose()
        rig = null
      }
      key.dispose()
      fill.dispose()
      ambient.dispose()
      dither?.dispose()
      renderer?.dispose()
      dither = null
      renderer = null
      els = null
      pokes.clear()
      places.clear()
      place = null
      sections = []
      styleCache.clear()
      hiddenCache.clear()
    },
  }
}
