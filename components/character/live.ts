/**
 * Everything the character layer needs once he is loaded: the engine (three.js + model), the action
 * menu, his lines and the visitor's look and visit flag. Imported only through one dynamic import() in
 * CharacterLayer, after the page is idle (spec §7.7), so none of it ships with the page's initial JS.
 */
export { createEngine } from '@/engine'
export { CASE_COMMENTS, QUIPS } from '@/engine/quips'
export { checkIn } from '@/engine/visitStore'
export { getLook, subscribeLook } from '@/lib/lookState'
export { ActionMenu } from './ActionMenu'
