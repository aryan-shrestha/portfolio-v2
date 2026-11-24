import { AmbientLight, Box3, DirectionalLight, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { elbowTarget } from './arms'
import { containShift } from './contain'
import { DEFAULT_LOOK, type Look } from './look'
import { buildCharacter, type Rig } from './model/build'
import { computePlacements, placementAt, smootherstep, type PlacementState } from './placement'
import { DURATION, hasPose, poseFor, type PoseKind } from './poses'
import { QUIPS } from './quips'
import { createDitherPass } from './render/dither'
import type { EngineAPI, Gesture, OutfitId, Placement, PlacementKind } from './types'

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
const mix = (a: PlacementState, b: PlacementState, t: number): PlacementState => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  S: lerp(a.S, b.S, t),
  talk: lerp(a.talk, b.talk, t),
  b: lerp(a.b, b.b, t),
  cx: b.cx ?? a.cx,
  cy: b.cy ?? a.cy,
  d: b.d ?? a.d,
})

export function createEngine(): EngineAPI {
  let els: { canvas: HTMLCanvasElement; handle: HTMLElement; bubble: HTMLElement; badge: HTMLElement } | null = null
  let renderer: WebGLRenderer | null = null
  let dither: ReturnType<typeof createDitherPass> | null = null
  let rig: Rig | null = null
  let raf = 0

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 6000)
  camera.position.set(0, 0, 3000)
  const ambient = new AmbientLight(0xffffff, 0.45)
  const key = new DirectionalLight(0xffffff, 3.0)
  key.position.set(-3, 4, 5)
  const fill = new DirectionalLight(0xffffff, 0.4)
  fill.position.set(4, -1, 3)
  scene.add(ambient, key, fill)

  const look: Look = { base: { ...DEFAULT_LOOK.base }, outfit: DEFAULT_LOOK.outfit }
  let visitorOutfit: OutfitId = look.outfit
  let chapterOutfit: OutfitId | null = null

  // layout
  let W = 0
  let H = 0
  let PX = 3
  let P: Record<PlacementKind, Placement> = computePlacements(1, 1)
  let sections: Section[] = []
  let topsDirty = false

  // placement + choreography
  let shown: PlacementState | null = null
  let blendFrom: PlacementState | null = null
  let blendT = 0
  let current = -1
  let lastSection: number | null = null
  let reduced = false
  let action: PoseKind | null = null
  let actionT = 0

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
  const sil = new Box3()
  const hb = new Box3()
  const tmp = new Box3()
  const v = new Vector3()
  /** Last value written per element and property: skip identical DOM writes every frame. */
  const styleCache = new Map<HTMLElement, Record<string, string>>()
  type Prop = 'transform' | 'width' | 'height' | 'opacity' | 'left' | 'top'
  const setStyle = (el: HTMLElement, prop: Prop, value: string) => {
    let c = styleCache.get(el)
    if (!c) styleCache.set(el, (c = {}))
    if (c[prop] === value) return
    c[prop] = value
    el.style[prop] = value
  }

  const kindNow = (): PlacementKind => (current >= 0 && sections[current] ? sections[current].kind : 'hero')
  const outfit = () => chapterOutfit ?? visitorOutfit
  const clock = () => performance.now() / 1000

  function buildRig() {
    if (rig) {
      scene.remove(rig.root)
      rig.dispose()
    }
    rig = buildCharacter(look)
    scene.add(rig.root)
  }

  /** Placements (needs the copy blocks on phones) and section tops. Cheap: no GPU work. */
  function relayout() {
    const mobile = W <= 900
    let copyBottom: number | undefined
    if (mobile) {
      for (const s of sections) {
        if (s.kind !== 'hero' && s.kind !== 'outro') continue
        const copy = s.el.querySelector('[data-copy]')
        if (copy) copyBottom = Math.max(copyBottom ?? 0, copy.getBoundingClientRect().bottom - s.el.getBoundingClientRect().top)
      }
    }
    P = computePlacements(W, H, { copyBottom })
    for (const s of sections) s.top = s.el.getBoundingClientRect().top + window.scrollY
    topsDirty = false
    // Case pages reserve a gutter of 0.85 × hero S × 3.5 (spec §6.6).
    document.documentElement.style.setProperty('--char-s', `${P.hero.S.toFixed(2)}px`)
  }

  function resize() {
    if (!els || !dither) return
    W = document.documentElement.clientWidth || window.innerWidth
    H = window.innerHeight
    PX = W < 600 ? 2 : 3
    dither.resize(W, H, PX)
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

  /** Where he should be this frame: scroll-scrubbed (spec §6.1), or still at the hero under reduced motion. */
  function target(): PlacementState {
    if (reduced || sections.length === 0) {
      current = -1
      return stateOf(P.hero)
    }
    const r = placementAt(window.scrollY, H, sections, P)
    current = r.current
    return r.st
  }

  function tick() {
    raf = requestAnimationFrame(tick)
    if (!rig || !dither || !els) return
    const now = clock()
    // Real elapsed time (spring sub-stepped) so slow frames don't slow him down; capped for tab returns.
    const dt = Math.min(0.1, now - last)
    last = now
    if (topsDirty) relayout()

    let st = target()
    if (blendFrom) {
      blendT += dt
      st = mix(blendFrom, st, smootherstep(Math.min(1, blendT / BLEND)))
      if (blendT >= BLEND) blendFrom = null
    }
    shown = st
    const kind = kindNow()

    // Section gestures: once the glide has settled, play the destination's gesture on each change.
    if (!blendFrom && current !== lastSection) {
      const g = current >= 0 ? sections[current].gesture : undefined
      if (g && !reduced) start(g)
      lastSection = current
    }
    // Chapter outfit overlays the visitor's from the slide's midpoint; released on leaving.
    const co = current >= 0 ? (sections[current].outfit ?? null) : null
    if (co !== chapterOutfit) chapterOutfit = co // geometry swap: Task 11

    if (action) {
      actionT += dt
      if (actionT > (DURATION[action] ?? 0)) action = null
    }
    const pose = poseFor(drag.active ? 'drag' : (action ?? 'idle'), actionT, {
      now: reduced ? 0 : now,
      toward: kind === 'right' ? -1 : 1, // point toward the screens, away from his own side
      vx: drag.vx,
    })
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

    const { root, body, head, face, arms, eyes, mouth } = rig
    root.scale.setScalar(st.S)
    root.position.set(st.x + offset.x, st.y + offset.y, 0)

    // Head: follows the cursor; while sliding between placements it turns toward travel.
    const travelV = prevX === null ? 0 : (st.x - prevX) / Math.max(dt, 1e-3)
    prevX = st.x
    travel = damp(travel, clamp(travelV / 900, -0.7, 0.7), 6, dt)
    root.updateMatrixWorld(true)
    face.getWorldPosition(v)
    const still = reduced
    const yaw = still ? 0 : clamp(((pointer.x - (W / 2 + v.x)) / W) * 1.1, -0.5, 0.5)
    const pitch = still ? 0 : clamp(((pointer.y - (H / 2 - v.y)) / H) * 0.8, -0.3, 0.3)
    head.rotation.y = damp(head.rotation.y, Math.abs(travel) > 0.05 ? travel : yaw, 8, dt)
    head.rotation.x = damp(head.rotation.x, pose.headX + pitch, 8, dt)
    head.rotation.z = damp(head.rotation.z, pose.headZ + (still ? 0 : Math.sin(now * 0.9) * 0.03), 8, dt)
    body.rotation.z = damp(body.rotation.z, pose.bodyZ - travel * 0.12, 10, dt)
    body.position.y = damp(body.position.y, pose.bodyY, 12, dt)
    arms.forEach((a, i) => {
      a.shoulder.rotation.z = damp(a.shoulder.rotation.z, pose.sh[i], 12, dt)
      const want = elbowTarget(a.shoulder.rotation.z, pose.sh[i], pose.el[i], a.side)
      a.elbow.rotation.z = damp(a.elbow.rotation.z, want, 18, dt)
    })
    if (!still) {
      blinkAt -= dt
      if (blinkAt < -0.12) blinkAt = 2 + Math.random() * 3
    }
    const blinking = blinkAt < 0
    eyes.open.visible = pose.wide
    eyes.smile.visible = !pose.wide
    eyes.open.scale.y = eyes.smile.scale.y = blinking ? 0.15 : 1
    mouth.open.visible = pose.open
    mouth.smile.visible = !pose.open

    // Containment on this frame's final pose (spec §7.5.1), not while he is the badge.
    if (st.b <= 0.01) {
      root.updateMatrixWorld(true)
      sil.setFromObject(root, true)
      const { dx, dy } = containShift({ minX: sil.min.x, maxX: sil.max.x, maxY: sil.max.y }, W, H, 0.06 * st.S + 2 * PX)
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
    root.updateMatrixWorld(true)

    // Badge: white disc with a vermilion ring; the clip closes in as he shrinks.
    const d = st.d ?? 0
    const cx = st.cx ?? 0
    const cy = st.cy ?? 0
    const inBadge = st.b > 0.001 && st.d !== undefined
    setStyle(els.badge, 'opacity', inBadge && st.b > 0.6 ? ((st.b - 0.6) / 0.4).toFixed(3) : '0')
    if (inBadge) {
      setStyle(els.badge, 'width', `${d}px`)
      setStyle(els.badge, 'height', `${d}px`)
      setStyle(els.badge, 'transform', `translate(${W / 2 + cx - d / 2}px, ${H / 2 - cy - d / 2}px)`)
    }
    const clip = inBadge ? { cx, cy, r: lerp(Math.hypot(W, H), d / 2 - 3, st.b) } : undefined

    // Grab handle over skull + torso + hair, on screen; only as big as the badge once he is one.
    hb.makeEmpty()
    for (const p of rig.handleParts) hb.union(tmp.setFromObject(p))
    let x0 = W / 2 + hb.min.x
    let x1 = W / 2 + hb.max.x
    let y0 = Math.max(0, H / 2 - hb.max.y)
    let y1 = Math.min(H, H / 2 - hb.min.y)
    if (inBadge && st.b > 0.5) {
      x0 = Math.max(x0, W / 2 + cx - d / 2)
      x1 = Math.min(x1, W / 2 + cx + d / 2)
      y0 = Math.max(y0, H / 2 - cy - d / 2)
      y1 = Math.min(y1, H / 2 - cy + d / 2)
    }
    setStyle(els.handle, 'transform', `translate(${x0.toFixed(1)}px, ${y0.toFixed(1)}px)`)
    setStyle(els.handle, 'width', `${Math.max(0, x1 - x0).toFixed(1)}px`)
    setStyle(els.handle, 'height', `${Math.max(0, y1 - y0).toFixed(1)}px`)

    // Bubble: a said line wins; otherwise the hero/outro greeting while he talks there.
    if (sayText && now >= sayUntil) sayText = null
    const text = sayText ?? (st.talk > 0.97 ? (kind === 'outro' ? QUIPS.outro : QUIPS.hero) : null)
    if (text && text !== bubbleHTML) {
      els.bubble.innerHTML = text
      bubbleHTML = text
      bw = els.bubble.offsetWidth
      bh = els.bubble.offsetHeight
    }
    if (!!text !== bubbleShown) {
      bubbleShown = !!text
      els.bubble.setAttribute('aria-hidden', String(!bubbleShown))
    }
    setStyle(els.bubble, 'opacity', text ? '1' : '0')
    rig.bubbleAnchor.getWorldPosition(v)
    setStyle(els.bubble, 'left', `${clamp(W / 2 + v.x, bw + 8, W - 8).toFixed(1)}px`)
    setStyle(els.bubble, 'top', `${clamp(H / 2 - v.y, bh + 8, H - 8).toFixed(1)}px`)

    dither.render(scene, camera, { px: PX, clip })
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
  const onDown = (e: PointerEvent) => {
    Object.assign(drag, { active: true, px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y, moved: 0, vx: 0 })
    vel.x = vel.y = 0
    els?.handle.setPointerCapture(e.pointerId)
    document.body.classList.add('char-dragging')
    e.preventDefault()
  }
  const onMove = (e: PointerEvent) => {
    if (!drag.active) return
    const prev = offset.x
    offset.x = drag.ox + (e.clientX - drag.px)
    offset.y = drag.oy - (e.clientY - drag.py)
    drag.vx = offset.x - prev
    const was = drag.moved
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.px, e.clientY - drag.py))
    if (was < POKE_PX && drag.moved >= POKE_PX) say(QUIPS.drag, 60_000)
  }
  const onUp = () => {
    if (!drag.active) return
    drag.active = false
    document.body.classList.remove('char-dragging')
    if (drag.moved < POKE_PX) pokes.forEach((cb) => cb())
    else say(QUIPS.drop, 2000)
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => (topsDirty = true)) : null

  return {
    mount(canvas, handle, bubble, badge) {
      if (els) return
      // Throws without WebGL; the caller falls back (Task 12).
      renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false })
      els = { canvas, handle, bubble, badge }
      dither = createDitherPass(renderer)
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
      handle.addEventListener('pointercancel', onUp)
      ro?.observe(document.body)
      if (!document.hidden) run()
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

    setLook(base) {
      look.base = { ...base }
      if (rig) buildRig()
    },
    setOutfit(id, priority = 'visitor') {
      if (priority === 'chapter') chapterOutfit = id
      else visitorOutfit = id
    },

    onPoke(cb) {
      pokes.add(cb)
      return () => void pokes.delete(cb)
    },

    debugState() {
      const a = action === 'idle' || action === 'drag' ? null : action
      if (!rig) return { minX: 0, maxX: 0, top: 0, S: 0, placement: kindNow(), outfit: outfit(), action: a }
      rig.root.updateMatrixWorld(true)
      sil.setFromObject(rig.root, true)
      return {
        minX: W / 2 + sil.min.x,
        maxX: W / 2 + sil.max.x,
        top: H / 2 - sil.max.y,
        S: rig.root.scale.x,
        placement: kindNow(),
        outfit: outfit(),
        action: a,
      }
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
        handle.removeEventListener('pointercancel', onUp)
        handle.style.width = handle.style.height = '0px'
        bubble.style.opacity = badge.style.opacity = '0'
        bubble.setAttribute('aria-hidden', 'true')
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
      sections = []
      styleCache.clear()
    },
  }
}
