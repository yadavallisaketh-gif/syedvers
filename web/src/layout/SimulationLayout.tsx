import { Suspense, lazy } from 'react'

import { ControlPanel } from '../ui/ControlPanel'

// three.js + post-processing is the heavy part of the bundle; load it after the panel paints
const SimulationCanvas = lazy(() => import('../scene/SimulationCanvas'))

/**
 * Asymmetric layout: the 3D canvas is the full-bleed hero; the control panel floats over its
 * right-hand quarter. `isolate` keeps in-scene DOM labels in the canvas' stacking context, below
 * the panel.
 */
export function SimulationLayout() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface max-lg:h-auto max-lg:min-h-dvh max-lg:overflow-visible">
      <main className="absolute inset-0 isolate max-lg:relative max-lg:h-[56svh]">
        <Suspense fallback={<div className="h-full w-full bg-surface" />}>
          <SimulationCanvas />
        </Suspense>
      </main>
      <ControlPanel />
    </div>
  )
}
