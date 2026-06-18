'use client'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { Suspense } from 'react'
import { useStoreConfig } from './hooks/useStoreConfig'
import { ModelLoader } from './ModelLoader'

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
      <div className="text-center">
        <div className="text-xl mb-2">Loading Store...</div>
        <div className="animate-pulse">Please wait</div>
      </div>
    </div>
  )
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black text-red-500">
      <div className="text-center">
        <div className="text-xl mb-2">Error</div>
        <div>{message}</div>
      </div>
    </div>
  )
}

export default function Scene() {
  const { config, loading, error } = useStoreConfig()

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen message={error} />
  if (!config) return <ErrorScreen message="No store config found" />

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.0,
      }}
      camera={{ position: [0, 1.6, 5], fov: 60, near: 0.1, far: 200 }}
    >
      {/* Dark background */}
      <color attach="background" args={['#0c0d0f']} />

      {/* HDRI lighting */}
      <Suspense fallback={null}>
        <Environment
          files="https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_09_1k.hdr"
          background={false}
          environmentIntensity={1.0}
          resolution={256}
        />
      </Suspense>

      {/* Key light (sun) */}
      <directionalLight
        position={[10, 15, 5]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      >
        <orthographicCamera
          attach="shadow-camera"
          args={[-20, 20, 20, -20, 0.1, 60]}
        />
      </directionalLight>

      {/* Fill light */}
      <directionalLight position={[-7, 4, -5]} intensity={0.5} color="#cdd6ff" />

      {/* Load models from config */}
      <Suspense fallback={null}>
        <ModelLoader files={config.files} />
      </Suspense>

      {/* Temporary ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <OrbitControls target={[0, 1, 0]} />
    </Canvas>
  )
}
