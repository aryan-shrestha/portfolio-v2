'use client'

import Link from 'next/link'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { pillClass } from '@/components/ui/Button'
import { QUIPS, REACTIONS } from '@/engine/quips'
import type { Action, EngineAPI, PlaceInfo } from '@/engine/types'

/** Menu order and labels (spec §7.4). */
const ITEMS: readonly { id: Action; label: string }[] = [
  { id: 'wave', label: 'Wave' },
  { id: 'dance', label: 'Dance' },
  { id: 'panic', label: 'Panic' },
  { id: 'fly', label: 'Fly' },
  { id: 'vanish', label: 'Vanish' },
  { id: 'hiccup', label: 'Hiccup' },
  { id: 'peekaboo', label: 'Peekaboo' },
  { id: 'selfie', label: 'Selfie' },
  { id: 'dizzy', label: 'Get dizzy' },
  { id: 'sneeze', label: 'Sneeze' },
  { id: 'sulk', label: 'Sulk' },
  { id: 'deploying', label: 'Deploy' },
]
const TITLE = 'Make me do a thing'
const POKE_MS = 2500
/** Rows to try, tallest first; the list fills columns top to bottom. */
const ROWS = [6, 4, 3, 2] as const
/** The menu's bottom sits this far above the pill's bottom (pill height + gap). */
const PILL_CLEARANCE = 62
/** "Dress me up" beside "Play with me", this far out (CSS px). */
const ROW_GAP = 12
/** Stacked above it instead, this far up (pill height + gap). */
const DRESS_STEP = 56
const REACTION_MS = 3000
/** Page text the pills keep clear of: the copy he stands beside (hero, contact) and the contact footer. */
const COPY_TEXT = ':is([data-copy], footer) :is(h1, h2, h3, p, a, button, li, span)'

/**
 * Where "Dress me up" stands, first that fits beside him and covers no page text: in a row beside "Play
 * with me" (on the far side from him), stacked above it (portrait phones), or as a round icon button in
 * the row (where the text comes close to him: the hero on landscape tablets).
 */
type DressAt = 'row' | 'column' | 'compact'
type Rect = { x: number; y: number; w: number; h: number }
/** The pills' sizes, fixed by their labels (CSS px). */
type Sizes = { play: number; dress: number; h: number }

/**
 * Where the button and menu sit: on the bottom edge, beside his resting silhouette, on the room side.
 * As the badge, `disc` is the badge circle (left edge and diameter, CSS px): the button becomes a
 * keyboard-only control laid exactly over it, so it never covers page text.
 */
type Anchor = {
  side: 'left' | 'right'
  offset: number
  badge: boolean
  lift: number
  shown: boolean
  /** where "Dress me up" stands; null where it does not show (as the badge, and on the dress-up stage) */
  dressAt: DressAt | null
  /** "Play with me"'s width and height: the row's step, and the round button's size */
  play: number
  h: number
  disc?: { left: number; size: number }
}

/** Gap to his silhouette and to the window edge (CSS px; the same as --char-edge). */
const gapFor = (W: number) => (W <= 900 ? 16 : 24)
/** How far the menu's bottom sits above his floor: clear of the pills beside him. */
const clearance = (a: Anchor) => (a.badge ? 0 : PILL_CLEARANCE + (a.dressAt === 'column' ? DRESS_STEP : 0))

function anchorFor(p: PlaceInfo, w: Sizes, textTop: (r: Rect) => number | null): Anchor {
  const gap = gapFor(p.W)
  const badge = p.kind === 'badge'
  let lift = p.lift // his floor above the window's bottom (dress-up stage on phones): sit on it too
  const shown = p.shown // reduced motion: not drawn in About and the chapters, so no pill there either
  // The area he stands in: the window, or the dress-up stage beside its controls.
  const [a0, a1] = p.area
  const disc = badge ? { left: p.left, size: p.right - p.left } : undefined
  // He stands right of the area's centre (or centred): the pills go on his left, else on his right;
  // null when `width` has no room there. Phones: where a centred place leaves no room, the engine steps
  // him left so the pill fits on his right (engine/placement `aside`).
  type At = { side: 'left' | 'right'; offset: number }
  const beside = (width: number): At | null => {
    if ((p.left + p.right) / 2 >= (a0 + a1) / 2)
      return p.left - gap - width >= a0 + gap ? { side: 'right', offset: p.W - p.left + gap } : null
    return a1 - p.right - gap - width >= gap ? { side: 'left', offset: p.right + gap } : null
  }
  // last resort (no room either side): the area's corner on his right
  const corner: At = { side: 'right', offset: p.W - a1 + gap }
  const base = () => ({ badge, lift, shown, disc, play: w.play, h: w.h })
  if (badge || p.kind === 'stage') return { ...base(), ...(beside(w.play) ?? corner), dressAt: null }

  // "Play with me" over page text (the contact footer where it runs on toward him): both pills rise above it.
  const home = beside(w.play) ?? corner
  const playX = home.side === 'left' ? home.offset : p.W - home.offset - w.play
  const over = textTop({ x: playX, y: p.H - gap - lift - w.h, w: w.play, h: w.h })
  if (over !== null) lift = Math.max(lift, p.H - gap - over + ROW_GAP)
  const clear = (r: Rect) => textTop(r) === null

  const dressW = (at: DressAt) => (at === 'compact' ? w.h : w.dress)
  const span = (at: DressAt) => (at === 'column' ? Math.max(w.play, w.dress) : w.play + ROW_GAP + dressW(at))
  const rect = (a: At, at: DressAt): Rect => {
    const step = at === 'column' ? 0 : w.play + ROW_GAP
    const x = a.side === 'left' ? a.offset + step : p.W - a.offset - step - dressW(at)
    const bottom = p.H - gap - lift - (at === 'column' ? DRESS_STEP : 0)
    return { x, y: bottom - w.h, w: dressW(at), h: w.h }
  }
  for (const at of ['row', 'column', 'compact'] as const) {
    const a = beside(span(at))
    if (a && clear(rect(a, at))) return { ...base(), ...a, dressAt: at }
  }
  // nothing clear of the text: the round button if it fits beside him, else stacked (as at the corner)
  const a = beside(span('compact'))
  return a ? { ...base(), ...a, dressAt: 'compact' } : { ...base(), ...(beside(span('column')) ?? corner), dressAt: 'column' }
}

/** The top of the highest page text on screen that `r` (window px) covers; null when it covers none. */
function textTop(r: Rect): number | null {
  let top: number | null = null
  for (const el of document.querySelectorAll(COPY_TEXT)) {
    const t = el.getBoundingClientRect()
    if (!t.width || !t.height || t.bottom <= 0 || t.top >= window.innerHeight) continue
    if (r.x < t.right && t.left < r.x + r.w && r.y < t.bottom && t.top < r.y + r.h) top = Math.min(top ?? t.top, t.top)
  }
  return top
}

const same = (a: Anchor | null, b: Anchor) =>
  !!a &&
  (Object.keys(b) as (keyof Anchor)[]).every((k) =>
    k === 'disc' ? a.disc?.left === b.disc?.left && a.disc?.size === b.disc?.size : a[k] === b[k],
  )

/**
 * The action menu (spec §7.3–7.4, §8): a speech-bubble list of his twelve actions. It opens on a
 * poke and from the "Play with me" pill, which sits on the bottom edge beside him and never over
 * page text. Menu-button pattern: arrows/Home/End move, Escape closes and returns focus, Tab leaves.
 */
export function ActionMenu({ engine }: { engine: EngineAPI }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  // no idle emotes or napping while the menu is open
  useEffect(() => engine.setMenuOpen(open), [engine, open])
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dressRef = useRef<HTMLAnchorElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  /** Where focus goes when the menu closes (the pill, or whatever had focus before a poke). */
  const returnTo = useRef<HTMLElement | null>(null)
  /** The pills' sizes (fixed by their labels), kept from the last time they were laid out. */
  const sizes = useRef<Sizes>({ play: 0, dress: 0, h: 0 })
  const menuId = useId()
  const titleId = useId()

  // Follow his resting place; the pills' sizes are fixed by their labels, measured when he moves (while shown).
  // Scrolling moves the page text under them (a place is taken as its section arrives): re-check then too.
  useEffect(() => {
    let last: PlaceInfo | null = null
    let frame = 0
    const update = () => {
      frame = 0
      if (!last) return
      const s = sizes.current
      const b = buttonRef.current
      if (b && !b.classList.contains('char-play-badge')) {
        s.play = b.offsetWidth || s.play
        s.h = b.offsetHeight || s.h
      }
      const d = dressRef.current
      if (d && !d.classList.contains('char-dress-compact')) s.dress = d.offsetWidth || s.dress
      const next = anchorFor(last, { play: s.play || 140, dress: s.dress || 140, h: s.h || 44 }, textTop)
      setAnchor((a) => (same(a, next) ? a : next))
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    const off = engine.onPlace((p) => {
      last = p
      update()
    })
    return () => {
      off()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [engine])

  // A poke opens the menu (he says the poke line with it).
  useEffect(
    () =>
      engine.onPoke(() => {
        engine.say(QUIPS.poke, POKE_MS)
        returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        setOpen(true)
      }),
    [engine],
  )

  // Fit the bubble inside the window. Short or landscape screens: more columns (6 → 4 → 3 → 2 rows) while
  // the width allows, then drop it toward the bottom edge (over the pill), and scroll only as a last resort.
  useLayoutEffect(() => {
    const m = menuRef.current
    const list = listRef.current
    if (!open || !m || !list || !anchor) return
    const W = document.documentElement.clientWidth
    const H = window.innerHeight
    const edge = gapFor(W)
    // layout sizes (offset*), not the rect: the enter animation scales the bubble while we measure
    const fitsH = () => m.offsetHeight <= H - 2 * edge
    m.style.maxHeight = m.style.overflowY = ''
    let rows: number = ROWS[0]
    list.style.setProperty('--rows', String(rows))
    for (const r of ROWS.slice(1)) {
      if (fitsH()) break
      list.style.setProperty('--rows', String(r))
      if (m.offsetWidth > W - 2 * edge) {
        list.style.setProperty('--rows', String(rows)) // too wide: keep the previous layout
        break
      }
      rows = r
    }
    if (!fitsH()) {
      m.style.maxHeight = `${H - 2 * edge}px`
      m.style.overflowY = 'auto'
    }
    const width = m.offsetWidth
    const height = m.offsetHeight
    // Always written (React leaves an unchanged style prop alone, so a stale fit would stick).
    const bottom = edge + anchor.lift + clearance(anchor)
    m.style.bottom = `${bottom + height > H - edge ? Math.max(edge, H - edge - height) : bottom}px`
    m.style[anchor.side] = `${Math.max(edge, Math.min(anchor.offset, W - edge - width))}px`
  }, [open, anchor])

  // Opening moves focus to the first action.
  useEffect(() => {
    if (open) itemRefs.current[0]?.focus()
  }, [open])

  // A press anywhere else closes it (no focus jump: the press decides where focus goes).
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || buttonRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [open])

  const close = () => {
    setOpen(false)
    const back = buttonRef.current && buttonRef.current.offsetParent !== null ? buttonRef.current : returnTo.current
    back?.focus()
  }

  const choose = (a: Action) => {
    engine.play(a)
    engine.say(REACTIONS[a], REACTION_MS)
    close()
  }

  const onMenuKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemRefs.current.filter((b): b is HTMLButtonElement => !!b)
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const go = (n: number) => {
      e.preventDefault()
      items[(n + items.length) % items.length]?.focus()
    }
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        return go(i + 1)
      case 'ArrowUp':
      case 'ArrowLeft':
        return go(i - 1)
      case 'Home':
        return go(0)
      case 'End':
        return go(items.length - 1)
      case 'Escape':
        e.preventDefault()
        return close()
      case 'Tab':
        setOpen(false) // focus moves on as usual
    }
  }

  const badge = anchor?.badge ?? false
  const disc = anchor?.disc
  const away = anchor ? !anchor.shown : false
  const dressAt = anchor?.dressAt ?? null
  const pos = (extraBottom: number): CSSProperties | undefined =>
    anchor
      ? { [anchor.side]: `${anchor.offset}px`, bottom: `calc(var(--char-edge) + ${anchor.lift + extraBottom}px)` }
      : undefined

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        // As the badge: a keyboard stop laid over the badge disc (presses go through to him: a poke opens
        // the menu, a drag carries him), so keyboard users keep the menu on case pages and in Experience.
        className={disc ? 'char-play char-play-badge' : `${pillClass} char-play`}
        // laid out but unseen until he has a place, so its width can be measured
        style={
          disc
            ? { left: `${disc.left}px`, bottom: 'var(--char-edge)', width: `${disc.size}px`, height: `${disc.size}px` }
            : (pos(0) ?? { visibility: 'hidden' })
        }
        hidden={(badge && !disc) || away}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          returnTo.current = buttonRef.current
          setOpen((o) => !o)
        }}
      >
        {disc ? <span className="sr-only">Play with me</span> : 'Play with me'}
      </button>
      {/* The dress-up page, one press away wherever the pill shows (client navigation: he comes along). */}
      <Link
        ref={dressRef}
        href="/dress-up"
        className={`${pillClass} char-play${dressAt === 'compact' ? ' char-dress-compact' : ''}`}
        title={dressAt === 'compact' ? 'Dress me up' : undefined}
        style={
          !anchor
            ? { visibility: 'hidden' }
            : dressAt === 'column'
              ? pos(DRESS_STEP)
              : {
                  [anchor.side]: `${anchor.offset + anchor.play + ROW_GAP}px`,
                  bottom: `calc(var(--char-edge) + ${anchor.lift}px)`,
                  ...(dressAt === 'compact' ? { width: `${anchor.h}px`, height: `${anchor.h}px` } : null),
                }
        }
        hidden={anchor ? !dressAt || away : false}
      >
        {dressAt === 'compact' ? <Hanger /> : null}
        <span className={dressAt === 'compact' ? 'sr-only' : undefined}>Dress me up</span>
      </Link>
      {open && anchor ? (
        <div
          ref={menuRef}
          className="char-menu"
          data-side={anchor.side}
          style={pos(clearance(anchor))}
          onKeyDown={onMenuKey}
        >
          <p id={titleId} className="char-menu-title">
            {TITLE}
          </p>
          <div ref={listRef} id={menuId} role="menu" aria-labelledby={titleId} className="char-menu-list">
            {ITEMS.map((it, i) => (
              <button
                key={it.id}
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="char-menu-item"
                onClick={() => choose(it.id)}
              >
                {it.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}

/** A clothes hanger: the round "Dress me up" button's face. */
function Hanger() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 6.5a2.5 2.5 0 1 1 3.4 2.33c-.55.22-.9.74-.9 1.33V11" />
      <path d="M12 11 3 17.2c-.6.42-.3 1.3.42 1.3h17.16c.72 0 1.02-.88.42-1.3L12 11Z" />
    </svg>
  )
}
