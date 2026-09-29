import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type ComponentRef, useEffect, useRef } from 'react'

import { COLORS } from '../ui/tokens'
import { frame, sceneX, sceneZ } from './frame'
import { hideLabel, placeLabel } from './labels'

const TETHER_Y = 2.05 // just above the roofline, so it reads over both cars
const MIN_ERROR_M = 0.3 // below this the two cars overlap; nothing useful to draw

/**
 * The "drift tether": a dashed line from the ground-truth ghost to the estimated car, with a
 * floating label carrying the live position error (the same number as the panel's hero readout).
 */
export function DriftTether() {
  const line = useRef<ComponentRef<typeof Line>>(null)
  useEffect(() => () => hideLabel('tether'), [])

  useFrame(({ camera, size }) => {
    const l = line.current
    if (!l) return
    const { est, truth, error } = frame
    const ok = Number.isFinite(error) && error >= MIN_ERROR_M
    l.visible = ok
    if (!ok) {
      hideLabel('tether')
      return
    }

    const x1 = sceneX(truth.x)
    const z1 = sceneZ(truth.y)
    const x2 = sceneX(est.x)
    const z2 = sceneZ(est.y)
    l.geometry.setPositions([x1, TETHER_Y, z1, x2, TETHER_Y, z2])
    l.computeLineDistances()
    // dashes are in world units; keep them a few pixels long at any zoom
    const dash = Math.max(0.35, 5 * frame.worldPerPx)
    l.material.dashSize = dash
    l.material.gapSize = dash * 0.75

    const mid = { x: (x1 + x2) / 2, y: TETHER_Y, z: (z1 + z2) / 2 }
    placeLabel('tether', mid, camera, size, `Δ ${error.toFixed(1)} m`)
  })

  return (
    <Line
        ref={line}
        points={[
          [0, TETHER_Y, 0],
          [0, TETHER_Y, 1],
        ]}
        color={COLORS.tether}
        lineWidth={1.25}
        dashed
        dashSize={0.5}
        gapSize={0.35}
        renderOrder={30}
      />
  )
}
