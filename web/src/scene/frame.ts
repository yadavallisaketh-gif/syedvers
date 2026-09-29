import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { MathUtils, Vector3, type PerspectiveCamera } from 'three'

import { cursorAt, covarianceEllipse, estimatePose, lerpCol, replaySpan, truthPose, type Cursor, type Ellipse, type Pose } from '../sim/sampling'
import { UI_HZ, clock, useSim } from '../sim/store'

/**
 * Per-frame view of the replay at `clock.t`, computed once by <PlaybackDriver> before any other
 * frame subscriber (negative priority) and read by the scene components.
 */
export const frame = {
  t: 0,
  cursor: { i: 0, j: 0, f: 0 } as Cursor,
  est: { x: 0, y: 0, yaw: 0 } as Pose,
  truth: { x: 0, y: 0, yaw: 0 } as Pose,
  error: 0,
  sigma: 0,
  ellipse: { major: 0, minor: 0, angle: 0 } as Ellipse,
  /** metres per screen pixel at the vehicle's distance from the camera */
  worldPerPx: 0.02,
}

/** ENU metres -> scene coordinates (x east, y up, z = -north). */
export const sceneX = (east: number) => east
export const sceneZ = (north: number) => -north

const carPos = new Vector3()

export function PlaybackDriver() {
  const lastSync = useRef(0)

  useFrame((state, delta) => {
    const s = useSim.getState()
    const r = s.replay
    if (!r) return

    if (s.playing) {
      const [, end] = replaySpan(r)
      // clamp dt so a backgrounded tab doesn't jump the replay on return (still real-time down to 4 fps)
      const t = Math.min(clock.t + Math.min(delta, 0.25) * s.speed, end)
      clock.t = t
      if (t >= end) s.pause()
      else if (state.clock.elapsedTime - lastSync.current > 1 / UI_HZ) {
        lastSync.current = state.clock.elapsedTime
        s.syncT(t)
      }
    }

    const c = cursorAt(r.columns.relT, clock.t)
    const k = r.columns
    frame.t = clock.t
    frame.cursor = c
    frame.est = estimatePose(r, c)
    frame.truth = truthPose(r, c)
    frame.error = Math.hypot(frame.est.x - frame.truth.x, frame.est.y - frame.truth.y)
    frame.sigma = lerpCol(k.posSigma, c)
    frame.ellipse = covarianceEllipse(lerpCol(k.pXX, c), lerpCol(k.pYY, c), lerpCol(k.pXY, c))
    const cam = state.camera as PerspectiveCamera
    const dist = cam.position.distanceTo(carPos.set(sceneX(frame.est.x), 0, sceneZ(frame.est.y)))
    frame.worldPerPx = (2 * dist * Math.tan(MathUtils.degToRad(cam.fov) / 2)) / Math.max(state.size.height, 1)
  }, -2)

  return null
}
