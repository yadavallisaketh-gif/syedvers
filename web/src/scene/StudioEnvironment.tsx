import { Environment, Lightformer } from '@react-three/drei'

/**
 * Image-based lighting from a small procedural "studio": a large overhead softbox and two dim side
 * panels, rendered once into a cube map. No HDRI download, so the scene looks the same offline.
 */
export function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1} environmentIntensity={0.45}>
      <color attach="background" args={['#141416']} />
      <Lightformer form="rect" intensity={1.6} color="#f1f1ef" position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={[24, 24, 1]} />
      <Lightformer form="rect" intensity={0.5} color="#dde3ec" position={[-14, 4, -4]} rotation-y={Math.PI / 2} scale={[16, 5, 1]} />
      <Lightformer form="rect" intensity={0.3} color="#ecebe8" position={[14, 3, 6]} rotation-y={-Math.PI / 2} scale={[12, 4, 1]} />
    </Environment>
  )
}
