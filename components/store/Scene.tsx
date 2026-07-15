'use client'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import * as THREE from 'three'
import { Suspense } from 'react'
import { Physics } from '@react-three/rapier'
import { useStoreConfig } from './hooks/useStoreConfig'
import { ModelLoader } from './ModelLoader'
import { usePhysics } from './PhysicsSystem'
import { usePlayerController } from './PlayerController'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import { VirtualJoystick } from './Joystick'
import { usePOVCamera } from './POVCamera'
import { ShadowSystem } from './ShadowSystem'
import { ReflectiveFloor } from './ReflectiveFloor'
import { PostProcessing } from './PostProcessing'
import { useState, useEffect, useCallback } from 'react'
import ProductInteraction, { type ProductData } from './ProductInteraction'
import ProductPopup from './ProductPopup'
import { LoadingScreen } from './LoadingScreen'
import { ModelsLoadingIndicator } from './ModelsLoadingIndicator'
import { Stats } from '@react-three/drei'
import { AudioPlayer } from './AudioPlayer'
import { GyroToggle } from './GyroToggle'
import { SceneTransition } from './SceneTransition'
import { CameraTransition } from './CameraTransition'
import { ParticleReveal } from './ParticleReveal'

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

function PhysicsManager({
  onSetJoystickInput,
  gyroEnabled
}: {
  onSetJoystickInput: (callback: (x: number, y: number) => void) => void
  gyroEnabled: boolean
}) {
  const physics = usePhysics()
  const { setJoystickInput } = usePlayerController(physics)
  usePOVCamera({ gyroEnabled })

  useEffect(() => {
    onSetJoystickInput(() => (x: number, y: number) => setJoystickInput(x, y))
  }, [setJoystickInput, onSetJoystickInput])

  return (
    <RigidBody
      ref={physics.rigidBodyRef}
      type="dynamic"
      position={[0, 1.6, 5]}
      enabledRotations={[false, true, false]}
      lockRotations
      linearDamping={2.5}
      angularDamping={10}
      canSleep={false}
    >
      <CapsuleCollider args={[0.6, 0.35]} />
    </RigidBody>
  )
}

type LoadingPhase = 'loading' | 'transitioning' | 'ready'

export default function Scene() {
  const { config, loading, error } = useStoreConfig()
  const [joystickCallback, setJoystickCallback] = useState<((x: number, y: number) => void) | null>(null)
  const [showClickHint, setShowClickHint] = useState(true)
  const [loadingPhase, setLoadingPhase] = useState<LoadingPhase>('loading')
  const [loadedCount, setLoadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<ProductData | null>(null)
  const [gyroEnabled, setGyroEnabled] = useState(false)

  const handleModelsLoaded = useCallback(() => {
    setLoadingPhase('transitioning')
  }, [])

  const handleTransitionComplete = useCallback(() => {
    setLoadingPhase('ready')
  }, [])

  useEffect(() => {
    if (config) {
      setTotalCount(config.files.length)
    }
  }, [config])

  useEffect(() => {
    const hideHint = () => setShowClickHint(false)
    window.addEventListener('mousedown', hideHint, { once: true })
    return () => window.removeEventListener('mousedown', hideHint)
  }, [])

  if (loading) return <LoadingScreen />
  if (error) return <ErrorScreen message={error} />
  if (!config) return <ErrorScreen message="No store config found" />

  return (
    <>
      <Canvas
        style={{ touchAction: 'none' }}
        // shadows
        dpr={[1, 1.3]}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.3,
        }}
        camera={{ position: [0, 1.6, 5], fov: 60, near: 0.1, far: 200 }}
      >
        <Physics gravity={[0, -30, 0]} timeStep="vary">
         {/* FPS Stats */}
      {/* <Stats /> */}
      {/* Dark background */}
      {/* <color attach="background" args={['#1a1a1a']} /> */}

      {/* HDRI lighting */}
      <Suspense fallback={null}>
        <Environment
          files="/hdr/main_hdr.exr"
          background={false}
          environmentIntensity={.5}
          resolution={256}
          // blur={1}
        />
      </Suspense>

      {/* Key light (sun) */}
      {/* <directionalLight
        position={[10, 5, 5]}
        intensity={2.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      > */}
                {/* Param	Value	Effect
        left/right	±20	Shadow width: 40 units total
        top/bottom	±20	Shadow depth: 40 units total
        near	0.1	Closest shadow distance from light
        far	60	Farthest shadow distance from light 
           In your scene: Everything within ±20 units horizontally and up to 60 units deep will cast shadows. Objects outside this area won't cast shadows.  */}
        {/* <orthographicCamera
          attach="shadow-camera"
          args={[-20, 20, 20, -20, 0.1, 60]}
        />
      </directionalLight> */}



      {/* Fill light */}
      {/* <directionalLight position={[0, 2, -5]} intensity={9} color="#000000" /> */}

      {/* PCSS Soft Shadows */}
      {/* <ShadowSystem size={25} samples={17} focus={0} /> */}

      {/* Vitrine spotlights */}
      <pointLight position={[0, 7, -1.5]} intensity={18} distance={12} decay={.7} color="#ffffff" /> 
      {/* <pointLight position={[6.5, 1.2, 0.05]} intensity={30} distance={10} decay={0.3} color="#ffffff" />  */}

      {/* Load models from config */}
      <Suspense fallback={null}>
        <ModelLoader files={config.files} onModelsLoaded={handleModelsLoaded} onProgress={setLoadedCount} />
      </Suspense>

      {/* Scene transition effects */}
      <SceneTransition
        isTransitioning={loadingPhase === 'transitioning'}
        onComplete={handleTransitionComplete}
      />
      <CameraTransition
        isTransitioning={loadingPhase === 'transitioning'}
        targetPosition={[0, 2.5, 5]}
      />
      <ParticleReveal isTransitioning={loadingPhase === 'transitioning'} />

      {/* Physics system - only after transition ready */}
      {loadingPhase === 'ready' && <PhysicsManager onSetJoystickInput={setJoystickCallback} gyroEnabled={gyroEnabled} />}

      {/* Product click interaction */}
      {loadingPhase === 'ready' && <ProductInteraction onProductClick={setSelectedProduct} />}

      {/* Reflective Floor (Phase 9) */}
      <ReflectiveFloor opacity={1} size={20} mixStrength={.9} blur={0} roughness={62} />

      {/* Post-Processing (Phase 10) */}
      <PostProcessing />
      </Physics>
      </Canvas>

      {/* Loading indicator while models load */}
      {loadingPhase !== 'ready' && (
        <ModelsLoadingIndicator
          fadeOut={loadingPhase === 'transitioning'}
          loadedCount={loadedCount}
          totalCount={totalCount}
        />
      )}

      {/* Virtual joystick for mobile - only after ready */}
      {loadingPhase === 'ready' && joystickCallback && <VirtualJoystick onMove={joystickCallback} />}

      {/* Drag to look around hint */}
      {/* {modelsLoaded && showClickHint && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/70 text-white px-6 py-3 rounded-lg text-sm">
            Drag to look around • WASD to move
          </div>
        </div>
      )} */}

      {/* Product popup */}
      <ProductPopup product={selectedProduct} onClose={() => setSelectedProduct(null)} />

      {/* Background audio */}
      <AudioPlayer />

      {/* Gyroscope controls */}
      {loadingPhase === 'ready' && <GyroToggle onGyroChange={setGyroEnabled} />}

      {/* Bottom-left logo */}
      <div style={{ 
    left:' 1rem',
    maxWidth: '12rem',
    height: 'auto',
    bottom: '1rem',

      }} className="fixed bottom-6 left-6 md:bottom-8 md:left-8 z-10 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/Lumina-full.png"
          alt="OC Jewelry"
          className="h-16 md:h-20 w-auto object-contain opacity-80 hover:opacity-100 transition-opacity duration-300"
          style={{
            filter: "drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3))",
          }}
        />
      </div>
    </>
  )
}
