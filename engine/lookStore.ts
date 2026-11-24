import { DEFAULT_LOOK, HAIR_STYLES, OUTFITS, SWATCHES, type Look } from './look'

/** localStorage key for the visitor's look (spec §7.6). Bump the suffix if the schema changes. */
export const LOOK_KEY = 'aryan:look:v1'

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && list.includes(v as T)

/** A fresh copy of Aryan's own look (callers may mutate it). */
export const defaultLook = (): Look => ({ base: { ...DEFAULT_LOOK.base }, outfit: DEFAULT_LOOK.outfit })

/**
 * Validates a stored look. Every field must be one of the dress-up options (spec §7.6): a hair style,
 * a swatch from each palette, a boolean for glasses and a known outfit. Anything else → null.
 * Extra keys are dropped.
 */
export function parseLook(v: unknown): Look | null {
  if (!isObj(v) || !isObj(v.base)) return null
  const { hair, hairColor, skin, hoodie, glasses } = v.base
  if (
    !oneOf(HAIR_STYLES, hair) ||
    !oneOf(SWATCHES.hair, hairColor) ||
    !oneOf(SWATCHES.skin, skin) ||
    !oneOf(SWATCHES.hoodie, hoodie) ||
    typeof glasses !== 'boolean' ||
    !oneOf(OUTFITS, v.outfit)
  )
    return null
  return { base: { hair, hairColor, skin, hoodie, glasses }, outfit: v.outfit }
}

/** The given storage, or localStorage; null when there is none or touching it throws (privacy modes). */
function storageOf(storage?: Storage): Storage | null {
  try {
    return storage ?? (typeof window === 'undefined' ? null : window.localStorage)
  } catch {
    return null
  }
}

/** The visitor's saved look; Aryan's own when nothing valid is stored or storage is unavailable. */
export function loadLook(storage?: Storage): Look {
  try {
    const raw = storageOf(storage)?.getItem(LOOK_KEY)
    if (raw) return parseLook(JSON.parse(raw)) ?? defaultLook()
  } catch {
    // unreadable storage or garbage JSON: fall through to the default
  }
  return defaultLook()
}

/** Saves the look; never throws (full or blocked storage just means it is not remembered). */
export function saveLook(look: Look, storage?: Storage): void {
  try {
    storageOf(storage)?.setItem(LOOK_KEY, JSON.stringify(look))
  } catch {
    // the page works without storage (spec §7.6)
  }
}
