import Link from 'next/link'
import { site } from '@/lib/site'
import { ContactEmail } from './ContactEmail'

const footerLink =
  'inline-flex min-h-11 items-center text-paper underline-offset-4 hover:text-accent hover:underline'

function Dot() {
  return (
    <span aria-hidden="true" className="text-paper/40 phone:hidden">
      ·
    </span>
  )
}

/**
 * Section 7 (spec §6.1, §6.5): dark section with click-to-copy email. Phones: the footer sits
 * with the copy at the top so the character (outro placement, bottom-centre) never covers links.
 */
export function Contact() {
  return (
    <section
      id="contact"
      data-place="outro"
      data-gesture="wave"
      className="grid-bg flex h-svh flex-col justify-between bg-ink px-(--m) pt-[12svh] pb-(--m) text-paper [--focus:var(--paper)] [--gl:var(--grid-line-dark)] phone:justify-start phone:gap-8 phone:pt-[10svh]"
    >
      <div data-copy>
        <h2 className="display text-[clamp(52px,8.6vw,140px)] font-extrabold">Got a project?</h2>
        <p className="mt-4 text-xl text-paper/75">I&apos;m taking on new work.</p>
        <div className="mt-7">
          <ContactEmail email={site.email} />
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-x-4 text-[15px] text-paper/75 phone:gap-x-6">
        <span>© 2026 {site.name}</span>
        <Dot />
        <a href={site.linkedin} target="_blank" rel="noopener noreferrer" className={footerLink}>
          LinkedIn
        </a>
        <Dot />
        <a href={site.github} target="_blank" rel="noopener noreferrer" className={footerLink}>
          GitHub
        </a>
        <Dot />
        {/* client navigation: the character layer persists into the dress-up page (spec §5) */}
        <Link href="/dress-up" className={footerLink}>
          Dress me up
        </Link>
      </footer>
    </section>
  )
}
