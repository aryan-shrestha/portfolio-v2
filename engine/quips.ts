import type { Action } from './types'

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
  /** on a poke (the action menu opens with it) */
  poke: 'Psst. You can grab me.',
  /** the window crosses 900 px (wired in Task 12) */
  mobile: 'Ooh, phone size. I can squeeze in.',
  /** hero greeting for a returning visitor (wired in Task 12) */
  returning: "Oh hi, you're <b>back</b>. Same tour, fresh coffee.",
  /** idle routines (engine/idle.ts): napping, woken up, back on the tab */
  sleep: 'Zzz…',
  wake: "I'm up! I'm up.",
  welcome: "Oh, you're <b>back</b>!",
} as const

/** What he says as he plays each action from the menu (spec §7.4). */
export const REACTIONS: Record<Action, string> = {
  wave: 'Hey, you!',
  dance: 'Tests passed. Dance break.',
  panic: 'Who pushed to main on a Friday?',
  fly: 'Turns out I can fly. Filing a bug.',
  vanish: 'Brb, garbage collected.',
  hiccup: 'Sorry. <b>Hic.</b> Too much cold brew.',
  peekaboo: 'Boo! Okay, that one was for me.',
  selfie: 'One for the portfolio.',
  dizzy: 'Whoa. Which way is prod?',
  sneeze: 'Allergic to legacy code.',
  sulk: 'Fine. Nobody reviews my PRs anyway.',
  deploying: 'Shipped it. On a Tuesday, like a grown-up.',
}

/** One comment per case-study page, keyed by slug (`data-case-comment`). */
export const CASE_COMMENTS: Record<string, string> = {
  'napa-valley-weddings': "I'd RSVP yes to this one.",
  bevlytics: 'The data had opinions.',
  'data-to-insights': 'Trust the data. Check it anyway.',
}
