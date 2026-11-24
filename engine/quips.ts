/**
 * Everything he says (spec §7.3, §7.4, §6.6). Written fresh in Aryan's voice: short, first person,
 * a bit cheeky, no factual claims. Strings may contain <b> (shown in the highlight colour).
 * No three.js here: the character layer imports this without pulling in the engine chunk.
 */
export const QUIPS = {
  hero: "Hi, I'm <b>Aryan</b>. Scroll down and I'll show you around.",
  outro: 'Got something to build? <b>Say hi.</b>',
  copied: 'Copied! Talk soon.',
  /** while he is carried */
  drag: 'Whoa, put me down!',
  /** on release after a drag */
  drop: 'Smooth landing. Mostly.',
  /** on a poke */
  poke: 'Psst. You can grab me.',
} as const

/** One comment per case-study page, keyed by slug (`data-case-comment`). */
export const CASE_COMMENTS: Record<string, string> = {
  'napa-valley-weddings': "I'd RSVP yes to this one.",
  bevlytics: 'The data had opinions.',
  'data-to-insights': 'Trust the data. Check it anyway.',
}
