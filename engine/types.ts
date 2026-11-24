import type { Look } from './look'

export type OutfitId = 'hoodie' | 'blazer-bowtie' | 'hardhat' | 'detective'
export type HairStyle = 'wavy-fringe' | 'short-crop' | 'curly-top' | 'buzz'
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
  /** the floor he stands on (y up from the window centre): nothing of him draws below it; default: the window's bottom */
  floor?: number
}

/** The action menu's full set (spec §7.4). */
export type Action =
  | 'wave'
  | 'dance'
  | 'panic'
  | 'fly'
  | 'vanish'
  | 'hiccup'
  | 'peekaboo'
  | 'selfie'
  | 'dizzy'
  | 'sneeze'
  | 'sulk'
  | 'deploying'

/** Engine state for tests (screen px; minX/maxX/top from the exact silhouette). */
export type DebugState = {
  minX: number
  maxX: number
  top: number
  S: number
  placement: PlacementKind
  /** the outfit he is wearing now (chapter or visitor, as resolved) */
  outfit: OutfitId
  action: Action | Gesture | null
  /** geometries alive on the GPU (leak check across look changes) */
  geometries: number
}

/** Where he rests now (CSS px from the window's left edge): the idle silhouette, or the badge circle. */
export type PlaceInfo = {
  kind: PlacementKind
  left: number
  right: number
  /** how far his floor sits above the window's bottom edge (the dress-up stage on phones) */
  lift: number
  /** left and right edges of the area he stands in: the window, or the dress-up stage */
  area: [number, number]
  W: number
  H: number
}

export interface EngineAPI {
  mount(canvas: HTMLCanvasElement, handle: HTMLElement, bubble: HTMLElement, badge: HTMLElement): void
  /** Re-read on every route change. Each element's `data-place` (and `data-outfit`, `data-gesture`) is read now. */
  setSections(els: HTMLElement[]): void
  play(action: Action): void
  gesture(g: Gesture): void
  /** Show `text` (may contain <b>) for `ms`; an empty string clears it. */
  say(text: string, ms?: number): void
  /** The visitor's base traits (hair, colours, glasses): rebuilds the model, keeping his pose. */
  setLook(base: Look['base']): void
  /**
   * The visitor's outfit. What he wears is resolved in one place each frame: a project chapter's own
   * outfit (spec §6.2) while he is in that chapter — from the midpoint of the slide in (p > 0.5) to the
   * midpoint of the slide out — otherwise this one. Chapters drive that override internally from their
   * `data-outfit`; there is no external "chapter" priority.
   */
  setOutfit(id: OutfitId): void
  onPoke(cb: () => void): () => void
  /** Called with his resting place now and whenever it changes (section, resize); returns unsubscribe. */
  onPlace(cb: (p: PlaceInfo) => void): () => void
  /** Screen px: silhouette left/right/top edges (exact Box3), px per model unit, and what he is doing. */
  debugState(): DebugState
  destroy(): void
}
