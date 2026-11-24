import type { CSSProperties, ReactNode } from 'react'

/** Wrap highlighted words in <b>; they take the `highlight` colour. */
export function Bubble({ highlight, children }: { highlight?: string; children: ReactNode }) {
  const style = highlight ? ({ '--hl': highlight } as CSSProperties) : undefined
  return (
    <div className="bubble" style={style}>
      {children}
    </div>
  )
}
