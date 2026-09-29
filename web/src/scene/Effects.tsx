import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing'

/**
 * Screen-space ambient occlusion (N8AO) for contact grounding, then SMAA.
 *
 * No filmic tone curve: the scene is lit to stay inside display range, and every curve tried
 * (Neutral, AgX, ACES) shifted the dark end, so the canvas no longer matched the page's zinc
 * background and the matte albedos drifted from their authored values. Output is linear -> sRGB.
 * Deliberately no bloom, vignette or chromatic aberration.
 */
export function Effects() {
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={2.2} distanceFalloff={1.2} intensity={2.4} quality="medium" halfRes color="#121214" />
      <SMAA />
    </EffectComposer>
  )
}
