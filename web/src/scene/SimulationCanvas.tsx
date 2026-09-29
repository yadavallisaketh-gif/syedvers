import { Canvas } from '@react-three/fiber'

import { useSim } from '../sim/store'
import type { Replay } from '../sim/types'
import { COLORS, SCENE } from '../ui/tokens'
import { CameraRig, ViewOffset } from './CameraRig'
import { DriftTether } from './DriftTether'
import { Effects } from './Effects'
import { PlaybackDriver } from './frame'
import { GnssMarkers } from './GnssMarkers'
import { SceneLabels } from './labels'
import { Ground } from './Ground'
import { Lighting } from './Lighting'
import { StudioEnvironment } from './StudioEnvironment'
import { TrackRibbon } from './TrackRibbon'
import { UncertaintyVolume } from './UncertaintyVolume'
import { VehicleProxy } from './VehicleProxy'

/**
 * Physically based, matte scene. 1 unit = 1 m; x = East, z = -North, y = up.
 * `flat`: no renderer tone mapping (see Effects.tsx for why the output stays linear).
 */
export default function SimulationCanvas() {
  const replay = useSim((s) => s.replay)
  return (
    <>
      <Canvas
        shadows="percentage"
        flat
        dpr={[1, 2]}
        gl={{ antialias: false, stencil: false, powerPreference: 'high-performance' }}
        camera={{ fov: 38, near: 1, far: 6000, position: [-18, 8, 0] }}
        aria-label="3D replay of the vehicle, its ground-truth track and the engine's estimate"
      >
        <color attach="background" args={[SCENE.background]} />
        <fog attach="fog" args={[SCENE.background, 160, 900]} />
        <StudioEnvironment />
        <Lighting />
        <Ground />
        <PlaybackDriver />
        <ViewOffset />
        {replay && <World replay={replay} />}
        <Effects />
      </Canvas>
      <SceneLabels />
    </>
  )
}

function World({ replay }: { replay: Replay }) {
  const layers = useSim((s) => s.layers)
  const c = replay.columns
  return (
    <group>
      {layers.route && <TrackRibbon xs={c.truthX} ys={c.truthY} color={SCENE.route} halfWidth={1.5} minPx={2.2} height={0.03} layer={0} />}
      <TrackRibbon xs={c.truthX} ys={c.truthY} color={COLORS.truth} halfWidth={0.28} minPx={1.2} height={0.05} layer={1} progressive />
      <TrackRibbon xs={c.x} ys={c.y} color={COLORS.estimate} halfWidth={0.28} minPx={1.2} height={0.07} layer={2} progressive />
      <GnssMarkers replay={replay} />
      <VehicleProxy which="estimate" color={COLORS.estimate} />
      {layers.ghost && <VehicleProxy which="truth" color={COLORS.truth} />}
      {layers.uncertainty && <UncertaintyVolume />}
      {layers.tether && <DriftTether />}
      <CameraRig replay={replay} />
    </group>
  )
}
