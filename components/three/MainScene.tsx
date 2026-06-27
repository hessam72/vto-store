"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  AdaptiveDpr,
  AdaptiveEvents,
  Preload,
} from "@react-three/drei";
import { EffectComposer, Bloom, DepthOfField, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

import SceneContent from "./SceneContent";

export default function MainScene() {
  return (
    <Canvas
      className="three-canvas"
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        // toneMapping and outputColorSpace set via the prop below
      }}
      camera={{ position: [0, 0, 8], fov: 45, near: 0.1, far: 200 }}
      dpr={[1, 2]}
      shadows
      flat={false}
      // Tone-mapping & color space
      onCreated={({ gl }) => {
        gl.setClearColor(0x060608, 1);
      }}
    >
      {/* Performance helpers */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />

      <Suspense fallback={null}>
        <SceneContent />

        {/* Post-processing */}
        <EffectComposer multisampling={4}>
          {/* Bloom — restrained, luxury not rave */}
          <Bloom
            intensity={0.6}
            luminanceThreshold={0.7}
            luminanceSmoothing={0.9}
            mipmapBlur
            blendFunction={BlendFunction.ADD}
          />

          {/* Depth of field — subtle cinematic focus */}
          <DepthOfField
            focusDistance={0.01}
            focalLength={0.025}
            bokehScale={2}
            blendFunction={BlendFunction.NORMAL}
          />

          {/* Vignette — frames the composition */}
          <Vignette
            offset={0.35}
            darkness={0.75}
            eskil={false}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>

        <Preload all />
      </Suspense>
    </Canvas>
  );
}
