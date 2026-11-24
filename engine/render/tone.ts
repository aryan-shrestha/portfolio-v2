/**
 * The scene's lights and the dither pass's tone curve, shared by the runtime, the dither shader and
 * the tests that check how a colour dithers (ruling R14: skin swatches stay ordered and distinct).
 */
export const LIGHTS = {
  ambient: 0.45,
  key: { intensity: 3.0, dir: [-3, 4, 5] as const },
  fill: { intensity: 0.4, dir: [4, -1, 3] as const },
}

/** Dither tone curve: l = clamp((luminance^(1/gamma) − lift) × gain, 0, 1); l is the share of paper dots. */
export const TONE = { gamma: 2.2, lift: 0.03, gain: 1.35 }

/** GLSL float literal. */
export const glsl = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n))

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const unit = (v: readonly number[]) => {
  const n = Math.hypot(...v)
  return v.map((x) => x / n)
}
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * Share of paper dots (`l` in the dither shader) for a Lambert surface of colour `hex` facing `normal`
 * (world space, toward the camera is +z), lit as the runtime lights the scene. Three's Lambert BRDF
 * is diffuse / π for ambient and direct light; the target is linear, the shader applies the curve.
 */
export function ditherLevel(hex: string, normal: readonly number[] = [0, 0, 1]): number {
  const [r, g, b] = [1, 3, 5].map((i) => srgbToLinear(parseInt(hex.slice(i, i + 2), 16) / 255))
  const n = unit(normal)
  const E =
    (LIGHTS.ambient +
      LIGHTS.key.intensity * Math.max(0, dot(n, unit(LIGHTS.key.dir))) +
      LIGHTS.fill.intensity * Math.max(0, dot(n, unit(LIGHTS.fill.dir)))) /
    Math.PI
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) * E
  return Math.min(1, Math.max(0, (lum ** (1 / TONE.gamma) - TONE.lift) * TONE.gain))
}
