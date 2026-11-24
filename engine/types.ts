export type OutfitId = 'hoodie' | 'blazer-bowtie' | 'hardhat' | 'detective'
export type Gesture = 'wave' | 'point' | 'thumbs' | 'think' | 'cheer'

export type PlacementKind = 'hero' | 'outro' | 'left' | 'right' | 'badge' | 'stage'

/** CSS px from the window centre, y up. `x`,`y` is the character origin; screen px = origin + model * S. */
export type Placement = {
  x: number
  y: number
  /** px per model unit */
  S: number
  talk: 0 | 1
  badge: 0 | 1
  /** badge circle centre */
  cx?: number
  cy?: number
  /** badge circle diameter in px */
  d?: number
}
