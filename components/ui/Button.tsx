import type { ReactNode } from 'react'
import Link from 'next/link'

type Props = { href?: string; onClick?: () => void; children: ReactNode; className?: string }

/** The site's pill: 1.5 px ink border, fully rounded, hard 4 px offset shadow (spec §4.3). */
export const pillClass =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-paper px-4 py-2.5 text-[15px] text-ink no-underline shadow-[4px_4px_0_var(--color-ink)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--color-ink)] active:translate-x-1 active:translate-y-1 active:shadow-none'

export function Button({ href, onClick, children, className = '' }: Props) {
  const cls = `${pillClass} ${className}`.trim()
  // Internal routes use client navigation so the character layer persists (spec §5).
  if (href?.startsWith('/')) {
    return (
      <Link href={href} onClick={onClick} className={cls}>
        {children}
      </Link>
    )
  }
  if (href) {
    return (
      <a href={href} onClick={onClick} className={cls}>
        {children}
      </a>
    )
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  )
}
