import { Line } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, type Group } from 'three'

import { COLORS, SCENE } from '../ui/tokens'
import { frame, sceneX, sceneZ } from './frame'

const CIRCLE = Array.from({ length: 97 }, (_, i) => {
  const a = (i / 96) * Math.PI * 2
  return [Math.cos(a), 0, Math.sin(a)] as [number, number, number]
})

/** Unit hemisphere as a clean latitude/longitude cage (no triangle diagonals). */
function cageGeometry(meridians = 16, parallels = [0.3, 0.6, 0.85], seg = 64) {
  const v: number[] = []
  for (let m = 0; m < meridians; m++) {
    const a = (m / meridians) * Math.PI * 2
    for (let k = 0; k < 12; k++) {
      const p0 = (k / 12) * (Math.PI / 2)
      const p1 = ((k + 1) / 12) * (Math.PI / 2)
      v.push(Math.cos(a) * Math.cos(p0), Math.sin(p0), Math.sin(a) * Math.cos(p0))
      v.push(Math.cos(a) * Math.cos(p1), Math.sin(p1), Math.sin(a) * Math.cos(p1))
    }
  }
  for (const f of parallels) {
    const lat = f * (Math.PI / 2)
    for (let k = 0; k < seg; k++) {
      const a0 = (k / seg) * Math.PI * 2
      const a1 = ((k + 1) / seg) * Math.PI * 2
      v.push(Math.cos(a0) * Math.cos(lat), Math.sin(lat), Math.sin(a0) * Math.cos(lat))
      v.push(Math.cos(a1) * Math.cos(lat), Math.sin(lat), Math.sin(a1) * Math.cos(lat))
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(v, 3))
  return g
}

/**
 * 1-sigma position uncertainty of the EKF around the estimated vehicle.
 * Footprint: the true 1-sigma ellipse of the 2x2 position covariance (semi-axes and orientation
 * from its eigen-decomposition), drawn as a pixel-width outline on the ground. Over it, a matte
 * translucent shell with a lat/long cage. The filter is 2-D, so the dome's height
 * (0.6 x the geometric-mean radius, clamped to 1.6-14 m) is a display aid only.
 */
export function UncertaintyVolume() {
  const root = useRef<Group>(null)
  const dome = useRef<Group>(null)
  const ring = useRef<Group>(null)
  const cage = useMemo(() => cageGeometry(), [])
  useEffect(() => () => cage.dispose(), [cage])
  const hemisphere = useMemo(() => [1, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2] as const, [])

  useFrame(() => {
    const e = frame.ellipse
    const g = root.current
    if (!g || !dome.current || !ring.current) return
    const ok = Number.isFinite(e.major) && Number.isFinite(frame.est.x) && e.major > 0.05
    g.visible = ok
    if (!ok) return
    g.position.set(sceneX(frame.est.x), 0, sceneZ(frame.est.y))
    g.rotation.y = e.angle // major axis, CCW from East (same convention as vehicle yaw)
    const minor = Math.max(e.minor, 0.05)
    const h = Math.min(Math.max(0.6 * Math.sqrt(e.major * minor), 1.6), 14)
    dome.current.scale.set(e.major, h, minor)
    ring.current.scale.set(e.major, 1, minor)
  })

  return (
    <group ref={root}>
      <group ref={dome}>
        <lineSegments geometry={cage} renderOrder={20}>
          <lineBasicMaterial color={SCENE.uncertainty} transparent opacity={0.22} depthWrite={false} />
        </lineSegments>
        <mesh renderOrder={19}>
          <sphereGeometry args={hemisphere} />
          <meshStandardMaterial
            color={COLORS.estimate}
            roughness={0.95}
            metalness={0.1}
            transparent
            opacity={0.06}
            side={DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>
      <group ref={ring} position-y={0.08}>
        <Line points={CIRCLE} color={SCENE.uncertainty} lineWidth={1.25} transparent opacity={0.7} />
      </group>
    </group>
  )
}
