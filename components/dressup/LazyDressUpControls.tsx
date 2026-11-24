'use client'

import { lazy, Suspense, type ComponentProps } from 'react'
import type { DressUpControls } from './DressUpControls'

const Controls = lazy(() => import('./DressUpControls').then((m) => ({ default: m.DressUpControls })))

/**
 * The dress-up controls, code-split. The root not-found boundary (which is this same page, spec §5) is
 * part of every route's tree, so a static import would ship the controls and the look store with every
 * page's initial JS; this way their chunk loads only where they render. Server-rendered as usual (the
 * server resolves the lazy import before it streams the HTML); hydrated once the chunk has arrived.
 */
export function LazyDressUpControls(props: ComponentProps<typeof DressUpControls>) {
  return (
    <Suspense fallback={null}>
      <Controls {...props} />
    </Suspense>
  )
}
