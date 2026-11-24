import type { Metadata } from 'next'
import { Bricolage_Grotesque, DM_Mono, Instrument_Sans } from 'next/font/google'
import './globals.css'

// Font pairing (spec 4.2, builder's call): Instrument Sans body + DM Mono mono.
// Rationale: Instrument Sans is a slightly condensed, warm grotesque with a clean
// rhythm that stays quiet under Bricolage's quirky display weight, and DM Mono's
// soft round forms match the pill/bubble shapes without the cold look of code-editor monos.
const display = Bricolage_Grotesque({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['700', '800'],
})
const body = Instrument_Sans({ variable: '--font-body', subsets: ['latin'] })
const mono = DM_Mono({ variable: '--font-mono', subsets: ['latin'], weight: ['400', '500'] })

export const metadata: Metadata = {
  title: 'Aryan Shrestha',
  description: 'Full-stack developer portfolio.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
