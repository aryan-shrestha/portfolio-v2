import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from 'next/font/google'
import { CharacterLayer } from '@/components/character/CharacterLayer'
import { SmoothScroll } from '@/components/SmoothScroll'
import { ogImage, siteUrl } from '@/lib/siteUrl'
import 'lenis/dist/lenis.css'
import './globals.css'

// Font pairing (spec 4.2, builder's call): Instrument Sans body + DM Mono mono.
// Rationale: Instrument Sans is a slightly condensed, warm grotesque with a clean
// rhythm that stays quiet under Bricolage's quirky display weight, and DM Mono's
// soft round forms match the pill/bubble shapes without the cold look of code-editor monos.
const display = Bricolage_Grotesque({
  variable: '--font-bricolage',
  subsets: ['latin'],
  weight: ['700', '800'],
})
const body = Instrument_Sans({ variable: '--font-instrument', subsets: ['latin'] })
const mono = DM_Mono({ variable: '--font-dm-mono', subsets: ['latin'], weight: ['400', '500'] })

// Copy from the hero (spec §6.1). The share image is rendered by scripts/render-og.mjs.
const description = 'Frontend, backend and the data in between. Freelance full-stack developer in Kathmandu.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'Aryan Shrestha — Full-stack developer', template: '%s — Aryan Shrestha' },
  description,
  openGraph: {
    type: 'website',
    siteName: 'Aryan Shrestha',
    title: 'Aryan Shrestha — Full-stack developer',
    description,
    locale: 'en',
    images: [ogImage],
  },
  twitter: { card: 'summary_large_image' },
}

export const viewport: Viewport = { themeColor: '#f6f4ee' }

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <CharacterLayer />
        <SmoothScroll />
      </body>
    </html>
  )
}
