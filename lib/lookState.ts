import { DEFAULT_LOOK, type Look } from '@/engine/look'
import { LOOK_KEY, loadLook, saveLook } from '@/engine/lookStore'

/**
 * The visitor's look on the client (spec §7.6): read from storage once, kept in memory, saved on
 * every change. The dress-up page reads it through useSyncExternalStore; the character layer
 * subscribes and hands it to the engine. Storage is optional (lookStore never throws).
 */
let current: Look | null = null
const listeners = new Set<() => void>()

/** Client snapshot: stable until the look changes. */
export const getLook = (): Look => (current ??= loadLook())
/** Server (and first hydration) snapshot: Aryan's own look. */
export const getServerLook = (): Look => DEFAULT_LOOK

export function setLook(next: Look): void {
  current = next
  saveLook(next)
  listeners.forEach((cb) => cb())
}

export function subscribeLook(cb: () => void): () => void {
  listeners.add(cb)
  // another tab dressed him up: re-read on the next snapshot
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LOOK_KEY && e.key !== null) return
    current = null
    cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}
