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
  outfit: OutfitId
  action: Action | Gesture | null
}

export interface EngineAPI {
  mount(canvas: HTMLCanvasElement, handle: HTMLElement, bubble: HTMLElement, badge: HTMLElement): void
  /** Re-read on every route change. Each element's `data-place` (and `data-outfit`, `data-gesture`) is read now. */
  setSections(els: HTMLElement[]): void
  play(action: Action): void
  gesture(g: Gesture): void
  /** Show `text` (may contain <b>) for `ms`; an empty string clears it. */
  say(text: string, ms?: number): void
  setLook(base: Look['base']): void
  setOutfit(id: OutfitId, priority?: 'visitor' | 'chapter'): void
  onPoke(cb: () => void): () => void
  /** Screen px: silhouette left/right/top edges (exact Box3), px per model unit, and what he is doing. */
  debugState(): DebugState
  destroy(): void
}
