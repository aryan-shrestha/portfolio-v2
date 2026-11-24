'use client'

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
const REACTION_MS = 3000

/** Where the button and menu sit: on the bottom edge, beside his resting silhouette, on the room side. */
type Anchor = { side: 'left' | 'right'; offset: number; badge: boolean; lift: number }

/** Gap to his silhouette and to the window edge (CSS px). */
const gapFor = (W: number) => (W <= 900 ? 16 : 24)

function anchorFor(p: PlaceInfo, buttonW: number): Anchor {
  const gap = gapFor(p.W)
  const badge = p.kind === 'badge'
  const lift = p.lift // his floor above the window's bottom (dress-up stage on phones): sit on it too
  // He stands right of centre (or centred): the button goes on his left, else on his right.
  if ((p.left + p.right) / 2 >= p.W / 2) {
    const room = p.left - gap - buttonW >= gap
    // No room beside him (phones: he is centred and wide): the corner on his right, over his sleeve.
    return { side: 'right', offset: room ? p.W - p.left + gap : gap, badge, lift }
  }
  const room = p.W - p.right - gap - buttonW >= gap
  return { side: 'left', offset: room ? p.right + gap : gap, badge, lift }
}

/**
 * The action menu (spec §7.3–7.4, §8): a speech-bubble list of his twelve actions. It opens on a
 * poke and from the "Play with me" pill, which sits on the bottom edge beside him and never over
 * page text. Menu-button pattern: arrows/Home/End move, Escape closes and returns focus, Tab leaves.
 */
export function ActionMenu({ engine }: { engine: EngineAPI }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  /** Where focus goes when the menu closes (the pill, or whatever had focus before a poke). */
  const returnTo = useRef<HTMLElement | null>(null)
  /** The pill's width (fixed by its label), kept from the last time it was laid out. */
  const pillW = useRef(0)
  const menuId = useId()
  const titleId = useId()

  // Follow his resting place; the pill's width is fixed by its label, measured when he moves.
  useEffect(
    () =>
      engine.onPlace((p) => {
        pillW.current = buttonRef.current?.offsetWidth || pillW.current || 140
        setAnchor(anchorFor(p, pillW.current))
      }),
    [engine],
  )

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
    const bottom = edge + anchor.lift + (anchor.badge ? 0 : PILL_CLEARANCE)
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
  const pos = (extraBottom: number): CSSProperties | undefined =>
    anchor
      ? { [anchor.side]: `${anchor.offset}px`, bottom: `calc(var(--char-edge) + ${anchor.lift + extraBottom}px)` }
      : undefined

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`${pillClass} char-play`}
        // laid out but unseen until he has a place, so its width can be measured
        style={pos(0) ?? { visibility: 'hidden' }}
        hidden={badge}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => {
          returnTo.current = buttonRef.current
          setOpen((o) => !o)
        }}
      >
        Play with me
      </button>
      {open && anchor ? (
        <div
          ref={menuRef}
          className="char-menu"
          data-side={anchor.side}
          style={pos(badge ? 0 : PILL_CLEARANCE)}
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
