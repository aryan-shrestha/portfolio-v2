import type { Gesture, OutfitId } from '@/engine/types'

export type Screen =
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'diagram'; id: 'napa' | 'bevlytics' | 'bevlytics-cloudwatch' }

export type ChapterData = {
  slug: string
  side: 'left' | 'right'
  tint: string
  fg: string
  highlight: string
  outfit: OutfitId
  host: string
  lines: { html: string; gesture: Gesture; screen: Screen }[]
}

const napaShot: Screen = {
  kind: 'image',
  src: '/work/napa-hero.webp',
  alt: 'Napa Valley Weddings home page in a browser',
}
const bevShot: Screen = {
  kind: 'image',
  src: '/work/bevlytics-hero.webp',
  alt: 'Bevlytics marketing page in a browser',
}

export const chapters: ChapterData[] = [
  {
    slug: 'napa-valley-weddings',
    side: 'left',
    tint: '#24402d',
    fg: '#f6f4ee',
    highlight: '#8a6a1f',
    outfit: 'blazer-bowtie',
    host: 'napavalleyweddings.com',
    lines: [
      {
        html: 'This is <b>Napa Valley Weddings</b>. I built the whole thing, front to back.',
        gesture: 'wave',
        screen: napaShot,
      },
      {
        html: '<b>Next.js</b> on the front, <b>Python and FastAPI</b> behind it.',
        gesture: 'point',
        screen: { kind: 'diagram', id: 'napa' },
      },
      {
        html: 'Couples plan their wine-country wedding here. I make sure <b>"Book Now"</b> actually books.',
        gesture: 'thumbs',
        screen: napaShot,
      },
    ],
  },
  {
    slug: 'bevlytics',
    side: 'right',
    tint: '#f6c9d8',
    fg: '#111110',
    highlight: '#b0144f',
    outfit: 'hardhat',
    host: 'bevlytics.ai',
    lines: [
      {
        html: 'This is <b>Bevlytics</b>. I built the pipeline that feeds it.',
        gesture: 'wave',
        screen: bevShot,
      },
      {
        html: 'Raw distributor data runs through <b>ETL on AWS Lambda</b> into <b>Snowflake</b>.',
        gesture: 'think',
        screen: { kind: 'diagram', id: 'bevlytics' },
      },
      {
        html: '<b>CloudWatch</b> watches the logs, so nobody has to at 3am.',
        gesture: 'thumbs',
        screen: { kind: 'diagram', id: 'bevlytics-cloudwatch' },
      },
    ],
  },
  {
    slug: 'data-to-insights',
    side: 'left',
    tint: '#151413',
    fg: '#f6f4ee',
    highlight: '#c2410c',
    outfit: 'detective',
    host: 'datatoinsights.ai',
    lines: [
      {
        html: 'This is <b>Data to Insights</b>. I built features on the front and back end.',
        gesture: 'wave',
        screen: {
          kind: 'image',
          src: '/work/dti-hero.webp',
          alt: 'Data to Insights marketing page in a browser',
        },
      },
      {
        html: '<b>NestJS and Postgres</b> behind, <b>React and TanStack</b> in front.',
        gesture: 'point',
        screen: {
          kind: 'image',
          src: '/work/dti-actions.webp',
          alt: 'Data to Insights Actions screen',
        },
      },
      {
        html: '<b>Zod</b> checks the data at every door.',
        gesture: 'think',
        screen: {
          kind: 'image',
          src: '/work/dti-chat.webp',
          alt: 'Data to Insights Chat screen',
        },
      },
    ],
  },
]
