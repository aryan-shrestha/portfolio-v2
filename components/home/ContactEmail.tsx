'use client'

import { CopyEmail } from '@/components/ui/CopyEmail'

const announce = () => window.dispatchEvent(new CustomEvent('email:copied'))

/** CopyEmail that tells the character layer when the address was copied. */
export function ContactEmail({ email }: { email: string }) {
  return <CopyEmail email={email} onCopied={announce} />
}
