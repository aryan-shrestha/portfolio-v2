import { Button } from '@/components/ui/Button'
import { site } from '@/lib/site'

/**
 * Section 1 (spec §6.1). The greeting bubble belongs to the character layer, not this section.
 * Phones: the headline block sits at the top so the character fits below it (`data-copy` is
 * the block the engine measures to cap his height).
 */
export function Hero() {
  return (
    <section
      data-place="hero"
      data-gesture="wave"
      className="grid-bg relative flex h-svh flex-col justify-between p-(--m) phone:justify-start phone:gap-[clamp(40px,9svh,80px)]"
    >
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-sm leading-snug">
          <b className="block font-sans text-lg font-semibold">{site.name}</b>
          {site.role}
        </p>
        <Button href="#contact">Get in touch ↓</Button>
      </div>
      <div data-copy>
        <h1 className="display max-w-[9ch] text-[clamp(52px,8.6vw,140px)] font-extrabold">
          I build the <em className="text-accent not-italic">whole</em> thing.
        </h1>
        <p className="mt-5 max-w-[34ch] text-[clamp(16px,1.4vw,20px)] text-ink/80">
          Frontend, backend and the data in between. Freelance full-stack developer in Kathmandu.
        </p>
      </div>
    </section>
  )
}
