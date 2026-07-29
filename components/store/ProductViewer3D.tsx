'use client'

import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, useGLTF } from '@react-three/drei'
import { Suspense, useMemo, useLayoutEffect, useState } from 'react'
import * as THREE from 'three'

// Configure DRACO path for useGLTF
useGLTF.setDecoderPath('/draco/')

const FIT_MARGIN = 1.15

interface ProductModelProps {
  glbPath: string
}

function ProductModel({ glbPath }: ProductModelProps) {
  const gltf = useGLTF(glbPath)

  const { scene, offset, fitScale } = useMemo(() => {
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

    // Measure the untouched clone: the offset must stay in the model's own units,
    // the normalizing scale is applied by the parent group so it scales the offset too.
    const box = new THREE.Box3().setFromObject(clonedScene)
    const sphere = box.getBoundingSphere(new THREE.Sphere())

    return {
      scene: clonedScene,
      offset: sphere.center.clone().negate(),
      // Normalize to a unit bounding sphere so the camera fit below is exact.
      fitScale: sphere.radius > 0 ? 1 / sphere.radius : 1,
    }
  }, [gltf.scene])

  return (
    <group scale={fitScale}>
      <primitive object={scene} position={offset} />
    </group>
  )
}

interface FitCameraProps {
  radius: number
  onFit: (distance: number) => void
}

/** Frames a sphere of `radius` centered at the origin, accounting for canvas aspect. */
function FitCamera({ radius, onFit }: FitCameraProps) {
  const camera = useThree((state) => state.camera)
  const size = useThree((state) => state.size)

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return

    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect)
    const distance = (FIT_MARGIN * radius) / Math.sin(Math.min(vFov, hFov) / 2)

    camera.position.set(0, 0, distance)
    camera.near = distance / 100
    camera.far = distance * 10
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()

    onFit(distance)
  }, [camera, size.width, size.height, radius, onFit])

  return null
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
  // Model is normalized to a unit bounding sphere, so the fit distance is aspect-driven only.
  const [fitDistance, setFitDistance] = useState(3)

  return (
    <div className="w-full h-full min-h-[300px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 to-black">
      <Canvas
        camera={{ position: [0, 0, 3], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <FitCamera radius={1} onFit={setFitDistance} />

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
        </Suspense>

        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          autoRotate
          autoRotateSpeed={2}
          enableDamping
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          minDistance={fitDistance * 0.4}
          maxDistance={fitDistance * 3}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
          }}
        />
      </Canvas>
    </div>
  )
}
