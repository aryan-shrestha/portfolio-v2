import type { ReactNode } from 'react'

type Props = { href?: string; onClick?: () => void; children: ReactNode; className?: string }

const base =
  'inline-flex items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-ink bg-paper px-4 py-2.5 text-[15px] text-ink no-underline shadow-[4px_4px_0_var(--color-ink)] transition-transform hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--color-ink)] active:translate-x-1 active:translate-y-1 active:shadow-none'

export function Button({ href, onClick, children, className = '' }: Props) {
  const cls = `${base} ${className}`.trim()
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
