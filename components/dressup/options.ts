import { HAIR_STYLES, OUTFITS, SWATCHES } from '@/engine/look'
import type { HairStyle, OutfitId } from '@/engine/types'

/** Every dress-up option (spec §7.6) with the name a screen reader hears. The first of each is Aryan's. */
const HAIR_NAMES: Record<HairStyle, string> = {
  'wavy-fringe': 'Wavy fringe',
  'short-crop': 'Short crop',
  'curly-top': 'Curly top',
  buzz: 'Buzz cut',
}
const OUTFIT_NAMES: Record<OutfitId, string> = {
  hoodie: 'Hoodie',
  'blazer-bowtie': 'Blazer and bow tie',
  hardhat: 'Hard hat',
  detective: 'Detective',
}
const HAIR_COLOURS = ['dark brown', 'black', 'brown', 'golden blond', 'grey']
const SKIN_TONES = ['medium-light', 'light', 'medium', 'medium-dark', 'dark']
const HOODIE_COLOURS = ['slate grey', 'navy', 'burgundy', 'forest green', 'stone', 'black']

const swatches = (hexes: readonly string[], names: string[]) => hexes.map((hex, i) => ({ value: hex, name: names[i] }))

export const OPTIONS = {
  hair: HAIR_STYLES.map((value) => ({ value, name: HAIR_NAMES[value] })),
  hairColor: swatches(SWATCHES.hair, HAIR_COLOURS),
  skin: swatches(SWATCHES.skin, SKIN_TONES),
  hoodie: swatches(SWATCHES.hoodie, HOODIE_COLOURS),
  outfit: OUTFITS.map((value) => ({ value, name: OUTFIT_NAMES[value] })),
}
