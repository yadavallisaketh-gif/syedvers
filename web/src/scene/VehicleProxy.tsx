import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Group } from 'three'

import { SCENE } from '../ui/tokens'
import { frame, sceneX, sceneZ } from './frame'

// Passenger-car proxy, metres. Local +x is forward.
const LENGTH = 4.5
const WIDTH = 1.8
const BODY_H = 0.72
const CLEARANCE = 0.3
const WHEEL_R = 0.34
const WHEEL_W = 0.24
const AXLE_X = 1.42
const WHEELS: [number, number][] = [
  [AXLE_X, WIDTH / 2 - 0.12],
  [AXLE_X, -(WIDTH / 2 - 0.12)],
  [-AXLE_X, WIDTH / 2 - 0.12],
  [-AXLE_X, -(WIDTH / 2 - 0.12)],
]

/**
 * Placeholder simulation object: a chamfered clay car. `which` picks the pose it follows:
 * the EKF estimate (solid, casts shadows) or ground truth (translucent ghost, no shadow).
 * Every material is meshStandardMaterial, roughness >= 0.7, metalness 0.1.
 */
export function VehicleProxy({ which, color }: { which: 'estimate' | 'truth'; color: string }) {
  const group = useRef<Group>(null)
  const ghost = which === 'truth'

  useFrame(() => {
    const g = group.current
    if (!g) return
    const p = ghost ? frame.truth : frame.est
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      g.visible = false
      return
    }
    g.visible = true
    g.position.set(sceneX(p.x), 0, sceneZ(p.y))
    g.rotation.y = p.yaw // ENU yaw is CCW from East, which is a +y rotation of local +x
  })

  const mat = (c: string, roughness: number) => (
    <meshStandardMaterial
      color={c}
      roughness={roughness}
      metalness={0.1}
      transparent={ghost}
      opacity={ghost ? 0.32 : 1}
      depthWrite={!ghost}
    />
  )
  const shadow = { castShadow: !ghost, receiveShadow: !ghost }

  return (
    <group ref={group}>
      <RoundedBox args={[LENGTH, BODY_H, WIDTH]} radius={0.16} smoothness={3} position={[0, CLEARANCE + BODY_H / 2, 0]} {...shadow}>
        {mat(color, 0.75)}
      </RoundedBox>
      {/* cabin, set back from the bonnet so the heading reads at a glance */}
      <RoundedBox args={[2.3, 0.6, WIDTH - 0.2]} radius={0.18} smoothness={3} position={[-0.35, CLEARANCE + BODY_H + 0.27, 0]} {...shadow}>
        {mat(ghost ? color : SCENE.cabin, 0.7)}
      </RoundedBox>
      {/* front marker strip */}
      <mesh position={[LENGTH / 2 - 0.01, CLEARANCE + BODY_H * 0.62, 0]} {...shadow}>
        <boxGeometry args={[0.04, 0.1, WIDTH - 0.5]} />
        {mat(ghost ? color : SCENE.trim, 0.7)}
      </mesh>
      {WHEELS.map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, WHEEL_R, z]} rotation-x={Math.PI / 2} {...shadow}>
          <cylinderGeometry args={[WHEEL_R, WHEEL_R, WHEEL_W, 24]} />
          {mat(ghost ? color : SCENE.tyre, 0.9)}
        </mesh>
      ))}
    </group>
  )
}
