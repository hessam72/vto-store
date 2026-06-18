'use client'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { Suspense } from 'react'
import { useStoreConfig } from './hooks/useStoreConfig'
import { ModelLoader } from './ModelLoader'
import { usePhysics } from './PhysicsSystem'
import { usePlayerController } from './PlayerController'
import { VirtualJoystick } from './Joystick'
import { usePOVCamera } from './POVCamera'
import { useState, useEffect, useCallback } from 'react'

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

function PhysicsManager({ onSetJoystickInput }: { onSetJoystickInput: (callback: (x: number, y: number) => void) => void }) {
  const physics = usePhysics()
  const { setJoystickInput } = usePlayerController(physics)
  usePOVCamera()

  useEffect(() => {
    onSetJoystickInput(setJoystickInput)
  }, [setJoystickInput, onSetJoystickInput])

  return null
}

export default function Scene() {
  const { config, loading, error } = useStoreConfig()
  const [joystickCallback, setJoystickCallback] = useState<((x: number, y: number) => void) | null>(null)
  const [showClickHint, setShowClickHint] = useState(true)
  const [modelsLoaded, setModelsLoaded] = useState(false)

  const handleModelsLoaded = useCallback(() => {
   
    setModelsLoaded(true)
  }, [])

  useEffect(() => {
    const hideHint = () => setShowClickHint(false)
    document.addEventListener('pointerlockchange', hideHint)
    return () => document.removeEventListener('pointerlockchange', hideHint)
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen message={error} />
  if (!config) return <ErrorScreen message="No store config found" />

  return (
    <>
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
      <color attach="background" args={['#1a1a1a']} />

      {/* HDRI lighting */}
      <Suspense fallback={null}>
        <Environment
          files="/hdr/studio_small_09_1k.hdr"
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
        <ModelLoader files={config.files} onModelsLoaded={handleModelsLoaded} />
      </Suspense>

      {/* Physics system (Octree + Capsule + Gravity) - only after models loaded */}
      {modelsLoaded && <PhysicsManager onSetJoystickInput={setJoystickCallback} />}

      {/* Temporary ground */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      </Canvas>

      {/* Loading indicator while models load */}
      {!modelsLoaded && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white px-6 py-3 rounded-lg text-sm">
            Loading 3D models... {modelsLoaded}e4
          </div>
        </div>
      )}

      {/* Virtual joystick for mobile - only after models loaded */}
      {modelsLoaded && joystickCallback && <VirtualJoystick onMove={joystickCallback} />}

      {/* Click to look around hint */}
      {modelsLoaded && showClickHint && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white px-6 py-3 rounded-lg text-sm">
            Click to look around • WASD to move • ESC to exit
          </div>
        </div>
      )}
    </>
  )
}
