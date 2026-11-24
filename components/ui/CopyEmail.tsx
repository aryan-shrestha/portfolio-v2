'use client'

import { useEffect, useRef, useState } from 'react'

type Props = { email: string; onCopied?: () => void }

export function CopyEmail({ email, onCopied }: Props) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(email)
    } catch {
      // No clipboard API, or permission denied: the mailto link below is the fallback.
      return
    }
    setCopied(true)
    onCopied?.()
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={copy}
        className="display cursor-pointer text-[clamp(22px,3vw,44px)] text-left hover:text-accent focus-visible:text-accent"
      >
        {email}
      </button>
      <span className="flex items-center gap-3 font-mono text-sm" aria-live="polite">
        <span>{copied ? 'Copied! Talk soon.' : 'Click to copy'}</span>
        <a href={`mailto:${email}`} className="underline underline-offset-4 hover:text-accent">
          Open in mail app
        </a>
      </span>
    </span>
  )
}
