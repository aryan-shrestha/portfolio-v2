/**
 * The still image of him (`public/character/still.png`, spec §7.7–7.8): the model-unit window it
 * shows and its pixel size. scripts/render-still.mjs renders the idle pose into exactly this frame
 * (3 CSS px per dither dot, so 200 × 250 dots), and the runtime lays the image over a placement with
 * the same maths it uses for the model: screen px = origin + model × S. No three.js here.
 */
export const STILL = { x0: -1.9, x1: 1.9, y0: -1.5, y1: 3.25, w: 600, h: 750 } as const

/** CSS px per model unit in the PNG itself. */
export const STILL_S = STILL.w / (STILL.x1 - STILL.x0)
