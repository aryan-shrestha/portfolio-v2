'use client'

import { useSyncExternalStore, type ReactNode } from 'react'
import { DEFAULT_LOOK, type Look } from '@/engine/look'
import { defaultLook } from '@/engine/lookStore'
import { getLook, getServerLook, setLook, subscribeLook } from '@/lib/lookState'
import { OPTIONS } from './options'

type Base = Look['base']

const sameLook = (a: Look, b: Look) =>
  a.outfit === b.outfit && (Object.keys(a.base) as (keyof Base)[]).every((k) => a.base[k] === b.base[k])

/** Pill toggle in the site's button language; pressed = pushed in and inked. */
const optionClass =
  'inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink bg-paper px-4 text-[15px] leading-tight text-ink shadow-[3px_3px_0_var(--color-ink)] transition-[translate,box-shadow,background-color,color] duration-150 ease-out not-aria-pressed:hover:-translate-y-px not-aria-pressed:hover:shadow-[3px_4px_0_var(--color-ink)] aria-pressed:translate-x-[3px] aria-pressed:translate-y-[3px] aria-pressed:bg-ink aria-pressed:text-paper aria-pressed:shadow-none'
/** Colour swatch; pressed = an ink ring around it. */
const swatchClass =
  'size-11 rounded-full border-[1.5px] border-ink transition-[scale,box-shadow] duration-150 ease-out not-aria-pressed:hover:scale-108 aria-pressed:shadow-[0_0_0_3px_#fff,0_0_0_5px_var(--color-ink)] focus-visible:outline-offset-[7px]'

function Group({ legend, note, children }: { legend: string; note?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-3 font-mono text-[13px] tracking-wide text-muted">{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-3">{children}</div>
      {note ? <p className="mt-3 text-[14px] leading-snug text-muted">{note}</p> : null}
    </fieldset>
  )
}

/**
 * The dress-up controls (spec §7.6): every option, saved per visitor (lib/lookState → localStorage,
 * optional). Server render and hydration use Aryan's own look; the saved one follows straight after.
 */
export function DressUpControls({ heading }: { heading: ReactNode }) {
  const look = useSyncExternalStore(subscribeLook, getLook, getServerLook)
  const base = (patch: Partial<Base>) => setLook({ ...look, base: { ...look.base, ...patch } })
  const isDefault = sameLook(look, DEFAULT_LOOK)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {heading}
        <button
          type="button"
          disabled={isDefault}
          onClick={() => setLook(defaultLook())}
          className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-ink bg-white px-4 text-[15px] font-semibold text-ink shadow-[3px_3px_0_var(--color-ink)] transition-[translate,box-shadow] duration-150 ease-out enabled:hover:translate-x-px enabled:hover:translate-y-px enabled:hover:shadow-[2px_2px_0_var(--color-ink)] enabled:active:translate-x-[3px] enabled:active:translate-y-[3px] enabled:active:shadow-none disabled:cursor-default disabled:border-ink/25 disabled:text-ink/40 disabled:shadow-none"
        >
          Reset
        </button>
      </div>
      <Group legend="Hair">
        {OPTIONS.hair.map((o) => (
          <button
            key={o.value}
            type="button"
            className={optionClass}
            aria-pressed={look.base.hair === o.value}
            onClick={() => base({ hair: o.value })}
          >
            {o.name}
          </button>
        ))}
      </Group>
      <Group legend="Hair colour">
        {OPTIONS.hairColor.map((o) => (
          <button
            key={o.value}
            type="button"
            className={swatchClass}
            style={{ background: o.value }}
            aria-label={`Hair colour: ${o.name}`}
            aria-pressed={look.base.hairColor === o.value}
            onClick={() => base({ hairColor: o.value })}
          />
        ))}
      </Group>
      <Group legend="Skin">
        {OPTIONS.skin.map((o) => (
          <button
            key={o.value}
            type="button"
            className={swatchClass}
            style={{ background: o.value }}
            aria-label={`Skin tone: ${o.name}`}
            aria-pressed={look.base.skin === o.value}
            onClick={() => base({ skin: o.value })}
          />
        ))}
      </Group>
      <Group legend="Hoodie colour">
        {OPTIONS.hoodie.map((o) => (
          <button
            key={o.value}
            type="button"
            className={swatchClass}
            style={{ background: o.value }}
            aria-label={`Hoodie colour: ${o.name}`}
            aria-pressed={look.base.hoodie === o.value}
            onClick={() => base({ hoodie: o.value })}
          />
        ))}
      </Group>
      <Group legend="Glasses">
        {[false, true].map((on) => (
          <button
            key={String(on)}
            type="button"
            className={optionClass}
            aria-pressed={look.base.glasses === on}
            onClick={() => base({ glasses: on })}
          >
            {on ? 'Round glasses' : 'No glasses'}
          </button>
        ))}
      </Group>
      <Group legend="Outfit" note="In the project chapters I still dress for the job.">
        {OPTIONS.outfit.map((o) => (
          <button
            key={o.value}
            type="button"
            className={optionClass}
            aria-pressed={look.outfit === o.value}
            onClick={() => setLook({ ...look, outfit: o.value })}
          >
            {o.name}
          </button>
        ))}
      </Group>
    </div>
  )
}
