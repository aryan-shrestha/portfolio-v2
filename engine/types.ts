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
  /**
   * How he is shown (spec §7.7–7.8): 'live' (the animated canvas), 'frame' (reduced motion: one still
   * canvas frame in the visitor's look, or of a chosen action's key pose; ruling R17), 'image' (still.png:
   * no WebGL), 'hidden' (still mode in About and the chapters).
   */
  view: 'live' | 'image' | 'frame' | 'hidden'
  /**
   * The badge's clip circle alone keeps him inside the padded window this frame (ruling R20, spec §7.5.1):
   * containment is skipped and nothing of him outside the circle is drawn, so his silhouette may cross an
   * edge. False whenever containment ran.
   */
  clipContained: boolean
  /**
   * With debugProbe on: opaque dots of the last drawn canvas frame in the leftmost column, the column
   * holding the window's last pixel, and the top row. [0, 0, 0] otherwise (and on camera-flash frames,
   * which light the whole window on purpose).
   */
  edge: [number, number, number]
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
  /** false while he is not drawn (reduced motion in About and the chapters): nothing to sit beside */
  shown: boolean
}

export interface EngineAPI {
  /**
   * Starts him in these elements. Returns false without WebGL (spec §7.7): he is then the still image
   * (still.png) at the hero, outro, badge and stage placements, with no interactions.
   */
  mount(
    canvas: HTMLCanvasElement,
    handle: HTMLElement,
    bubble: HTMLElement,
    badge: HTMLElement,
    still: HTMLImageElement,
  ): boolean
  /** Re-read on every route change. Each element's `data-place` (and `data-outfit`, `data-gesture`) is read now. */
  setSections(els: HTMLElement[]): void
  play(action: Action): void
  gesture(g: Gesture): void
  /** The hero greeting (may contain <b>): the first-visit line, or the returning visitor's (spec §7.3). */
  setGreeting(html: string): void
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
  /** Tests: read the canvas's edge dots back after every drawn frame (DebugState.edge). */
  debugProbe(on: boolean): void
  /**
   * scripts/render-still.mjs: draws `kind` (held, no idle motion) into the still frame (engine/stillFrame)
   * and returns the canvas as a PNG with the frame's rect in canvas pixels (dots). Null without WebGL or
   * when the window is too small for the frame at 3 px per dot.
   */
  debugStill(kind?: 'idle' | Action): { png: string; x: number; y: number; w: number; h: number } | null
  destroy(): void
}
