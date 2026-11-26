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

/**
 * Colour dither (v1.2, owner: picks must show). The dots take the surface's hue, darkened to
 * `dotValue`; the gaps take a light tint of it, at most `tintMax` of the way from white. How much hue
 * goes in scales with saturation above `satFloor`, so neutral colours (outline ink, the slightly cool
 * greys, white) stay ink on white.
 * The dither shader computes the same thing per pixel from the lit colour (white lights keep the hue).
 */
export const COLOUR = { dotValue: 0.5, dotSat: 1.8, tintSat: 3.4, tintMax: 0.5, satFloor: 0.1 }

const INK_RGB = [0x11 / 255, 0x11 / 255, 0x10 / 255]
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t)
const clamp01 = (v: number, hi = 1) => Math.min(hi, Math.max(0, v))

/** The dot and gap colours (sRGB, 0–1) the dither draws for a surface of colour `hex`. */
export function ditherColours(hex: string): { dot: number[]; gap: number[] } {
  const s = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const mx = Math.max(...s)
  const mn = Math.min(...s)
  const hue = mx > 1e-4 ? s.map((v) => v / mx) : [0, 0, 0]
  const sat = mx > 1e-4 ? Math.max(0, 1 - mn / mx - COLOUR.satFloor) / (1 - COLOUR.satFloor) : 0
  return {
    dot: mix(INK_RGB, hue.map((v) => v * COLOUR.dotValue), clamp01(sat * COLOUR.dotSat)),
    gap: mix([1, 1, 1], hue, clamp01(sat * COLOUR.tintSat, COLOUR.tintMax)),
  }
}

/** GLSL for the same mapping: sets `dotC` and `gapC` from the target colour `c` (linear) and `ink`/`paper`. */
export const COLOUR_GLSL = `
      vec3 sc = pow(max(c.rgb, vec3(0.0)), vec3(1.0 / 2.2));
      float mx = max(max(sc.r, sc.g), sc.b); float mn = min(min(sc.r, sc.g), sc.b);
      vec3 hue = mx > 1e-4 ? sc / mx : vec3(0.0); float sat = mx > 1e-4 ? max(0.0, 1.0 - mn / mx - ${glsl(COLOUR.satFloor)}) / ${glsl(1 - COLOUR.satFloor)} : 0.0;
      vec3 dotC = mix(ink, hue * ${glsl(COLOUR.dotValue)}, clamp(sat * ${glsl(COLOUR.dotSat)}, 0.0, 1.0));
      vec3 gapC = mix(paper, hue, clamp(sat * ${glsl(COLOUR.tintSat)}, 0.0, ${glsl(COLOUR.tintMax)}));`
