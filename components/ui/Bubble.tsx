import type { CSSProperties, ReactNode } from 'react'

/**
 * Speech bubble. Wrap highlighted words in <b>; they take the `highlight` colour.
 * `tail` draws a pointer off the bottom edge toward the speaker: 'left' or 'right' is the side
 * he stands on.
 */
export function Bubble({
  highlight,
  tail,
  children,
}: {
  highlight?: string
  tail?: 'left' | 'right'
  children: ReactNode
}) {
  const style = highlight ? ({ '--hl': highlight } as CSSProperties) : undefined
  return (
    <div className="bubble" data-tail={tail} style={style}>
      {children}
      {tail ? (
        <svg className="bubble-tail" viewBox="0 0 44 26" aria-hidden="true" focusable="false">
          {/* fill covers the bubble's bottom border across the base; only the two sides are inked */}
          <path d="M0 0 L40 24 L26 0 Z" fill="#fff" />
          <path d="M1 0 L40 24 L26 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="miter" />
        </svg>
      ) : null}
    </div>
  )
}
