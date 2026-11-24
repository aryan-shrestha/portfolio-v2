import type { Ref } from 'react'

/**
 * The still image of him (spec §7.7–7.8): `public/character/still.png`, rendered from the engine by
 * scripts/render-still.mjs. Shown instead of the live canvas under reduced motion and without WebGL;
 * the engine lays it over the hero/outro placement, clips it into the badge, or stands it on the
 * dress-up stage, and hides it everywhere else. Hidden + lazy: visitors who get the live character
 * never download it. Decorative (the greeting bubble and the page carry the words).
 */
export function StillFallback({ ref }: { ref: Ref<HTMLImageElement> }) {
  return (
    // A plain <img>: the engine sizes and places it every layout, and resampling would smear the dither.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      data-char="still"
      src="/character/still.png"
      alt=""
      aria-hidden="true"
      width={600}
      height={750}
      loading="lazy"
      decoding="async"
      hidden
      className="char-still"
    />
  )
}
