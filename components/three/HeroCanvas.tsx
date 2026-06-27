"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, Preload } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import GoldBarScene from "./GoldBarScene";

export default function HeroCanvas() {
  return (
    <Canvas
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      camera={{ position: [0, 1.5, 11], fov: 40, near: 0.1, far: 100 }}
      dpr={[1, 2]}
      shadows="soft"
      onCreated={({ gl }) => gl.setClearColor(0x0f0f0f, 1)}
    >
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />

      <Suspense fallback={null}>
        <GoldBarScene />

        <EffectComposer multisampling={4}>
          {/* Restrained bloom — gold surfaces only */}
          <Bloom
            intensity={0.45}
            luminanceThreshold={0.72}
            luminanceSmoothing={0.85}
            mipmapBlur
            blendFunction={BlendFunction.ADD}
          />
          {/* Cinematic frame vignette */}
          <Vignette
            offset={0.3}
            darkness={0.72}
            eskil={false}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>

        <Preload all />
      </Suspense>
    </Canvas>
  );
}
