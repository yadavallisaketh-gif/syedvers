import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { type ComponentRef, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Fog, MOUSE, MathUtils, type PerspectiveCamera, Vector3 } from 'three'

import { useSim } from '../sim/store'
import type { Replay } from '../sim/types'
import { frame, sceneX, sceneZ } from './frame'

const CHASE_BACK = 19
const CHASE_UP = 8.5
const CHASE_LOOK_AHEAD = 6
const SPREAD_CAP_M = 90 // beyond this error the chase view stops pulling back
const TRANSITION_S = 0.9
const ORBIT_RANGE: [number, number] = [22, 90] // m from the car when orbit mode takes over
const MIN_ORBIT_ELEVATION = 0.35 // rad

const car = new Vector3()
const goalPos = new Vector3()
const goalTarget = new Vector3()
const lastCar = new Vector3()
const move = new Vector3()

/**
 * Camera modes:
 *  chase    — damped follow behind the estimated car (heading-smoothed); it pulls back and aims
 *             between estimate and truth as the error grows, so both cars and the tether stay in view
 *  orbit    — OrbitControls around the car; the rig carries camera + target along with it
 *  plan     — top-down, framed on the whole replay; pan/zoom allowed, rotation locked
 * Mode switches ease over ~1 s with the controls disabled, then hand over.
 */
export function CameraRig({ replay }: { replay: Replay }) {
  const mode = useSim((s) => s.camera)
  const inset = useSim((s) => s.panelInset)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  const scene = useThree((s) => s.scene)
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null)
  const transition = useRef(0)
  const camYaw = useRef<number | null>(null)
  const target = useRef(new Vector3())

  // top-down framing of both tracks, sized for the part of the canvas not under the panel
  const bounds = useMemo(() => {
    const c = replay.columns
    let minX = Infinity
    let maxX = -Infinity
    let minZ = Infinity
    let maxZ = -Infinity
    for (const [xs, ys] of [
      [c.x, c.y],
      [c.truthX, c.truthY],
    ] as const) {
      for (let i = 0; i < xs.length; i++) {
        if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) continue
        minX = Math.min(minX, sceneX(xs[i]))
        maxX = Math.max(maxX, sceneX(xs[i]))
        minZ = Math.min(minZ, sceneZ(ys[i]))
        maxZ = Math.max(maxZ, sceneZ(ys[i]))
      }
    }
    return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, hx: (maxX - minX) / 2 + 25, hz: (maxZ - minZ) / 2 + 25 }
  }, [replay])

  const planHeight = () => {
    const tanHalf = Math.tan(MathUtils.degToRad(camera.fov) / 2)
    const visibleAspect = Math.max(size.width - inset, 200) / Math.max(size.height, 1)
    return Math.max(bounds.hz / tanHalf, bounds.hx / (tanHalf * visibleAspect)) * 1.08
  }

  // snap behind the car when a replay loads, so the camera doesn't fly in from the origin
  useLayoutEffect(() => {
    camYaw.current = null
    transition.current = 0
    lastCar.set(Number.NaN, 0, 0)
  }, [replay])

  useEffect(() => {
    transition.current = TRANSITION_S
  }, [mode])

  useFrame((_, delta) => {
    // easing uses (bounded) real time, so mode switches still land on slow GPUs
    const dt = Math.min(delta, 0.5)
    const ctl = controls.current
    car.set(sceneX(frame.est.x), 0, sceneZ(frame.est.y))
    if (!Number.isFinite(car.x) || !Number.isFinite(car.z)) return
    const first = !Number.isFinite(lastCar.x)
    move.subVectors(car, first ? car : lastCar)
    lastCar.copy(car)

    const easing = transition.current > 0
    transition.current = Math.max(transition.current - dt, 0)
    if (ctl) {
      ctl.enabled = mode !== 'chase' && !easing
      ctl.enableRotate = mode === 'orbit'
      ctl.mouseButtons.LEFT = mode === 'plan' ? MOUSE.PAN : MOUSE.ROTATE
    }

    if (mode === 'chase') {
      const yaw = frame.est.yaw
      camYaw.current = camYaw.current === null || first ? yaw : dampAngle(camYaw.current, yaw, 3, dt)
      const fx = Math.cos(camYaw.current)
      const fz = -Math.sin(camYaw.current)
      const spread = Math.min(Number.isFinite(frame.error) ? frame.error : 0, SPREAD_CAP_M)
      const back = CHASE_BACK + spread * 1.1
      const up = CHASE_UP + spread * 0.75
      // aim part-way towards the ground-truth ghost
      const tx = Number.isFinite(frame.truth.x) ? sceneX(frame.truth.x) : car.x
      const tz = Number.isFinite(frame.truth.y) ? sceneZ(frame.truth.y) : car.z
      const ax = car.x + (tx - car.x) * 0.4
      const az = car.z + (tz - car.z) * 0.4
      goalPos.set(ax - fx * back, up, az - fz * back)
      goalTarget.set(ax + fx * CHASE_LOOK_AHEAD, 1, az + fz * CHASE_LOOK_AHEAD)
      if (first) {
        camera.position.copy(goalPos)
        target.current.copy(goalTarget)
      } else {
        camera.position.lerp(goalPos, 1 - Math.exp(-dt * 4))
        target.current.lerp(goalTarget, 1 - Math.exp(-dt * 6))
      }
      camera.lookAt(target.current)
      ctl?.target.copy(target.current)
    } else if (ctl && mode === 'orbit') {
      // ride along with the car; the user orbits/zooms around it
      camera.position.add(move)
      ctl.target.add(move)
      if (easing) {
        // keep the current bearing, but bring the camera into a sensible range above the car
        goalTarget.set(car.x, 1, car.z)
        goalPos.subVectors(camera.position, goalTarget)
        const range = MathUtils.clamp(goalPos.length(), ORBIT_RANGE[0], ORBIT_RANGE[1])
        const flat = Math.hypot(goalPos.x, goalPos.z) || 1
        const elev = Math.max(Math.atan2(goalPos.y, flat), MIN_ORBIT_ELEVATION)
        goalPos.set((goalPos.x / flat) * Math.cos(elev), Math.sin(elev), (goalPos.z / flat) * Math.cos(elev))
        goalPos.multiplyScalar(range).add(goalTarget)
        const k = 1 - Math.exp(-dt * 5)
        camera.position.lerp(goalPos, k)
        ctl.target.lerp(goalTarget, k)
        camera.lookAt(ctl.target)
      }
    } else if (ctl && mode === 'plan') {
      if (easing) {
        const h = planHeight()
        goalTarget.set(bounds.cx, 0, bounds.cz)
        goalPos.set(bounds.cx, h, bounds.cz + h * 0.001) // tiny z offset: screen-up = North
        const k = 1 - Math.exp(-dt * 5)
        camera.position.lerp(goalPos, k)
        ctl.target.lerp(goalTarget, k)
        camera.lookAt(ctl.target)
      }
    }

    // fog scales with viewing distance so the ground fades into the page at any zoom
    const fog = scene.fog
    if (fog instanceof Fog) {
      const d = camera.position.distanceTo(ctl?.target ?? car)
      // capped inside the 3 km ground half-extent so its edge never shows as a horizon line
      fog.far = Math.min(Math.max(700, d * 6), 2600)
      fog.near = Math.min(Math.max(120, d * 2.2), fog.far * 0.6)
    }
  })

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.12}
      minDistance={5}
      maxDistance={2500}
      maxPolarAngle={Math.PI * 0.47}
      screenSpacePanning
    />
  )
}

function dampAngle(from: number, to: number, lambda: number, dt: number) {
  const diff = MathUtils.euclideanModulo(to - from + Math.PI, Math.PI * 2) - Math.PI
  return from + diff * (1 - Math.exp(-lambda * dt))
}

/**
 * The canvas runs full-bleed under the right-hand panel. Shift the projection centre left by half
 * the panel width so the subject sits in the middle of the visible part, not behind the panel.
 */
export function ViewOffset() {
  const inset = useSim((s) => s.panelInset)
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const size = useThree((s) => s.size)
  useLayoutEffect(() => {
    if (inset > 0 && size.width > inset) camera.setViewOffset(size.width, size.height, inset / 2, 0, size.width, size.height)
    else camera.clearViewOffset()
    camera.updateProjectionMatrix()
  }, [camera, inset, size.width, size.height])
  return null
}
