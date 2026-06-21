import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'

export function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      {/* N8AO - HEAVY: Screen-space ambient occlusion, multiple samples */}
      {/* <N8AO
        aoRadius={1.2}
        intensity={2.4}
        distanceFalloff={1.0}
        quality="performance"
        color="black"
      /> */}
      {/* Bloom - MODERATE: Multiple blur passes with mipmapBlur */}
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.5}
        luminanceSmoothing={0.2}
        mipmapBlur
        radius={0.1}
      />
      {/* SMAA - LIGHT: Edge-detection anti-aliasing */}
      {/* <SMAA /> */}
      {/* Vignette - VERY LIGHT: Simple screen overlay */}
      <Vignette
        eskil={false}
        offset={0.32}
        darkness={0.62}
      />
    </EffectComposer>
  )
}
