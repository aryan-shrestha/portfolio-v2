/** localStorage key for the returning-visitor flag (spec §7.3). */
export const VISIT_KEY = 'aryan:visited:v1'

/** localStorage, or null when there is none or touching it throws (privacy modes). */
function local(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

/**
 * Records this visit and says whether there was one before (spec §7.3: "Oh hi, you're back.").
 * Never throws: without storage every visit is a first visit. `storage` defaults to localStorage;
 * pass null for none.
 */
export function checkIn(storage: Storage | null = local()): boolean {
  let before = false
  try {
    before = storage?.getItem(VISIT_KEY) === '1'
  } catch {
    // unreadable storage: a first visit
  }
  try {
    storage?.setItem(VISIT_KEY, '1')
  } catch {
    // full or blocked storage: not remembered
  }
  return before
}
