'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import { Suspense, useRef, useMemo, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Configure DRACO path for useGLTF
useGLTF.setDecoderPath('/draco/')

interface ProductModelProps {
  glbPath: string
}

function ProductModel({ glbPath }: ProductModelProps) {
  const gltf = useGLTF(glbPath)
  const groupRef = useRef<THREE.Group>(null)

  useEffect(() => {
    console.log('🔍 Model loaded:', glbPath)
    console.log('📦 Scene:', gltf.scene)
    console.log('👥 Children:', gltf.scene.children.length)
  }, [glbPath, gltf])

  // Auto-rotate continuously
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5 // 0.5 rad/s
    }
  })

  const processedScene = useMemo(() => {
    const clonedScene = gltf.scene.clone(true)

    // Ensure all meshes are visible and properly configured
    clonedScene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.visible = true
        obj.castShadow = true
        obj.receiveShadow = true

        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
              mat.envMapIntensity = 1
              mat.needsUpdate = true
            }
          })
        }
      }
    })

    // Center the model
    const box = new THREE.Box3().setFromObject(clonedScene)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    console.log('📍 Center:', center.toArray())
    console.log('📏 Size:', size.toArray())

    clonedScene.position.sub(center)

    // Scale to fit
    const maxDim = Math.max(size.x, size.y, size.z)
    const scale = maxDim > 0 ? 2 / maxDim : 1

    console.log('🔢 Scale:', scale)

    clonedScene.scale.setScalar(scale)

    return clonedScene
  }, [gltf.scene])

  return (
    <group ref={groupRef}>
      <primitive object={processedScene} />
    </group>
  )
}

interface ProductViewer3DProps {
  glbPath: string
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  )
}

export default function ProductViewer3D({ glbPath }: ProductViewer3DProps) {
  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-black">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={<LoadingFallback />}>
        <Environment
          files="/hdr/main_hdr.exr"
          background={false}
          environmentIntensity={.5}
          resolution={256}
          // blur={1}
        />

          <ambientLight intensity={1.5} />
          {/* <directionalLight position={[5, 5, 5]} intensity={2} /> */}
          {/* <directionalLight position={[-5, -5, -5]} intensity={0.5} /> */}
          <ProductModel glbPath={glbPath} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={2}
            maxDistance={10}
            touches={{
              ONE: THREE.TOUCH.ROTATE,
              TWO: THREE.TOUCH.DOLLY_PAN
            }}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
