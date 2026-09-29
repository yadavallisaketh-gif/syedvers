import { Grid } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import type { Mesh, ShaderMaterial } from 'three'

import { useSim } from '../sim/store'
import { SCENE } from '../ui/tokens'
import { frame } from './frame'

/** Matte ground plane plus a recessive 10 m / 100 m survey grid. */
export function Ground() {
  const showGrid = useSim((s) => s.layers.grid)
  const grid = useRef<Mesh>(null)

  useFrame(() => {
    // keep the grid readable in top-down view: fade distance scales with camera distance
    const m = grid.current?.material as ShaderMaterial | undefined
    const fade = m?.uniforms?.fadeDistance
    if (fade) fade.value = Math.max(700, frame.worldPerPx * 2400)
  })

  return (
    <group>
      {/* tessellated (62 m tiles): one giant quad interpolates depth too coarsely after clipping,
          and the ribbons lying a few cm above it would z-fight into it */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[6000, 6000, 96, 96]} />
        <meshStandardMaterial color={SCENE.ground} roughness={0.95} metalness={0.1} />
      </mesh>
      {showGrid && (
        <Grid
          ref={grid}
          position={[0, 0.015, 0]}
          infiniteGrid
          cellSize={10}
          sectionSize={100}
          cellThickness={0.6}
          sectionThickness={1}
          cellColor={SCENE.gridCell}
          sectionColor={SCENE.gridSection}
          fadeDistance={700}
          fadeStrength={1.6}
        />
      )}
    </group>
  )
}
