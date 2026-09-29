import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'

import { sampleIndex } from '../sim/sampling'
import type { Replay } from '../sim/types'
import { SCENE } from '../ui/tokens'
import { frame, sceneX, sceneZ } from './frame'
import { type LabelId, hideLabel, placeLabel } from './labels'

const POST_H = 4

/** Survey posts where GNSS was cut and where it came back, placed on the true track. */
export function GnssMarkers({ replay }: { replay: Replay }) {
  const marks = useMemo(() => {
    const c = replay.columns
    const lost = sampleIndex(c.relT, 0)
    const back = sampleIndex(c.relT, replay.durationS)
    return [
      { id: 'gnssLost' as LabelId, t: c.relT[lost], x: c.truthX[lost], y: c.truthY[lost] },
      { id: 'gnssBack' as LabelId, t: c.relT[back], x: c.truthX[back], y: c.truthY[back] },
    ].filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y))
  }, [replay])

  return (
    <>
      {marks.map((m) => (
        <Marker key={m.id} {...m} />
      ))}
    </>
  )
}

function Marker({ id, x, y, t }: { id: LabelId; x: number; y: number; t: number }) {
  const group = useRef<Group>(null)
  const anchor = useMemo(() => ({ x: sceneX(x), y: POST_H + 0.4, z: sceneZ(y) }), [x, y])
  useEffect(() => () => hideLabel(id), [id])
  useFrame(({ camera, size }) => {
    const shown = frame.t >= t // appears once the replay reaches it
    if (group.current) group.current.visible = shown
    if (shown) placeLabel(id, anchor, camera, size)
    else hideLabel(id)
  })
  return (
    <group ref={group} position={[sceneX(x), 0, sceneZ(y)]}>
      <mesh position-y={POST_H / 2} castShadow>
        <cylinderGeometry args={[0.07, 0.07, POST_H, 12]} />
        <meshStandardMaterial color={SCENE.post} roughness={0.8} metalness={0.1} />
      </mesh>
      <mesh position-y={0.03} receiveShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.06, 24]} />
        <meshStandardMaterial color={SCENE.post} roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  )
}
