/**
 * The site's canonical origin (metadata, sitemap, robots). Server-only. The domain is not chosen yet
 * (spec §12): set SITE_URL (e.g. https://example.com) in the host's environment at launch. Until then a
 * Vercel build uses the project's production URL and a local build uses localhost.
 */
export const siteUrl = (
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000')
).replace(/\/$/, '')

/** The share image (public/og.png, rendered by scripts/render-og.mjs). Child routes that set their own
 *  `openGraph` repeat it: Next replaces the parent's openGraph object rather than merging it. */
export const ogImage = {
  url: '/og.png',
  width: 1200,
  height: 630,
  alt: 'I build the whole thing. Aryan Shrestha, full-stack developer, drawn as a dithered cartoon.',
}
