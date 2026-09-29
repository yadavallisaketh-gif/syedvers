import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { DirectionalLight } from 'three'

import { frame, sceneX, sceneZ } from './frame'

const KEY_OFFSET: [number, number, number] = [38, 62, 24] // ~52° sun elevation, from the south-east
const SHADOW_HALF_EXTENT = 36 // m around the vehicle

/**
 * Soft key + low fill. The key light's shadow frustum follows the vehicle, so a 2k shadow map stays
 * crisp anywhere on a kilometre-long replay. Softness comes from PCF filtering with a wide radius.
 */
export function Lighting() {
  const key = useRef<DirectionalLight>(null)

  useFrame(() => {
    const light = key.current
    if (!light) return
    const x = sceneX(frame.est.x)
    const z = sceneZ(frame.est.y)
    light.position.set(x + KEY_OFFSET[0], KEY_OFFSET[1], z + KEY_OFFSET[2])
    light.target.position.set(x, 0, z)
    light.target.updateMatrixWorld()
  })

  const e = SHADOW_HALF_EXTENT
  return (
    <>
      <hemisphereLight args={['#dcdfe5', '#27272a', 0.4]} />
      <directionalLight
        ref={key}
        color="#fbf9f5"
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-radius={5}
        shadow-camera-left={-e}
        shadow-camera-right={e}
        shadow-camera-top={e}
        shadow-camera-bottom={-e}
        shadow-camera-near={1}
        shadow-camera-far={220}
      />
      <directionalLight color="#cfd8e6" intensity={0.3} position={[-40, 30, -50]} />
    </>
  )
}
