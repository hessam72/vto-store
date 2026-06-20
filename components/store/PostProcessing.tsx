import { EffectComposer, Bloom, N8AO, SMAA, Vignette } from '@react-three/postprocessing'

export function PostProcessing() {
  return (
    <EffectComposer multisampling={0}>
      <N8AO
        aoRadius={1.2}
        intensity={2.4}
        distanceFalloff={1.0}
        quality="performance"
        color="black"
      />
      <Bloom
        intensity={0.42}
        luminanceThreshold={0.85}
        luminanceSmoothing={0.2}
        mipmapBlur
        radius={0.6}
      />
      <SMAA />
      <Vignette
        eskil={false}
        offset={0.32}
        darkness={0.62}
      />
    </EffectComposer>
  )
}
