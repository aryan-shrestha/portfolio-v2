import type { HairStyle, OutfitId } from './types'

export type { HairStyle, OutfitId }

/** Look config, also the dress-up schema (spec 7.1, 7.6). `base` is visitor-editable; `outfit` is the overlay. */
export type Look = {
  base: { hair: HairStyle; hairColor: string; skin: string; hoodie: string; glasses: boolean }
  outfit: OutfitId
}

export const DEFAULT_LOOK: Look = {
  base: { hair: 'wavy-fringe', hairColor: '#3a2f28', skin: '#efc6a2', hoodie: '#55555c', glasses: false },
  outfit: 'hoodie',
}

/** Swatches from spec 7.6; the first entry of each is the default. */
export const SWATCHES = {
  hair: ['#3a2f28', '#1a1a1a', '#6b4a2b', '#b8863b', '#9aa0a6'],
  skin: ['#efc6a2', '#f7dcc4', '#d9a47c', '#a8724f', '#6e4630'],
  hoodie: ['#55555c', '#2f4a6b', '#6b2f3a', '#3f5a3a', '#c9c4b8', '#1f1f22'],
} as const

export const HAIR_STYLES: readonly HairStyle[] = ['wavy-fringe', 'short-crop', 'curly-top', 'buzz']
export const OUTFITS: readonly OutfitId[] = ['hoodie', 'blazer-bowtie', 'hardhat', 'detective']
