'use client'
import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useLoader } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import type { ModelFile } from './hooks/useStoreConfig'
import type { StagePosition } from '@/types/api'

// Configure DRACO loader globally
const configureDracoLoader = () => {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  return dracoLoader
}

type ModelLoaderProps = {
  files: ModelFile[]
  allowedStages?: string[]
  onModelsLoaded?: () => void
  onProgress?: (loaded: number) => void
  onStagesDetected?: (stages: StagePosition[]) => void
}

export function ModelLoader({ files, allowedStages, onModelsLoaded, onProgress, onStagesDetected }: ModelLoaderProps) {
  const [loadedCount, setLoadedCount] = useState(0)
  const allStagesRef = useRef<StagePosition[]>([])

  // Sort by priority (0 = wireframe first)
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.priority - b.priority)
  }, [files])

  const handleModelLoaded = useCallback(() => {
    setLoadedCount(prev => {
      const newCount = prev + 1
      onProgress?.(newCount)
      return newCount
    })
  }, [onProgress])

  useEffect(() => {
    console.log(`Loaded ${loadedCount} of ${sortedFiles.length} models`)
    if (loadedCount >= sortedFiles.length && loadedCount > 0) {
      console.log('All models loaded:', loadedCount)
      onStagesDetected?.(allStagesRef.current)
      onModelsLoaded?.()
    }
  }, [loadedCount, sortedFiles.length, onModelsLoaded, onStagesDetected])

  const handleStagesFromModel = useCallback((stages: StagePosition[]) => {
    allStagesRef.current.push(...stages)
  }, [])

  return (
    <>
      {sortedFiles.map((file, idx) => (
        <Model
          key={file.url}
          url={file.url}
          isWireframe={file.priority === 0}
          allowedStages={allowedStages}
          onLoaded={handleModelLoaded}
          onStagesDetected={handleStagesFromModel}
        />
      ))}
    </>
  )
}



type ModelProps = {
  url: string
  isWireframe: boolean
  allowedStages?: string[]
  onLoaded?: () => void
  onStagesDetected?: (stages: StagePosition[]) => void
}

function Model({ url, isWireframe, allowedStages, onLoaded, onStagesDetected }: ModelProps) {
  // Use custom loader with DRACO support
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const dracoLoader = configureDracoLoader()
    loader.setDRACOLoader(dracoLoader)
  })

  useEffect(() => {
    if (gltf && onLoaded) {
      onLoaded()
    }
  }, [gltf, onLoaded])

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true)

    // Tag wireframe for physics system
    if (isWireframe) {
      clone.userData.isWireframeCollision = true
    }

    // Detect stage positions (max 15, early exit)
    const stages: StagePosition[] = []
    const allowedSet = allowedStages ? new Set(allowedStages) : null

    clone.traverse((obj) => {
      // Stage detection with early exit
      if (stages.length < 15 && allowedSet && allowedSet.has(obj.name)) {
        const worldPos = new THREE.Vector3()
        obj.getWorldPosition(worldPos)

        stages.push({
          name: obj.name,
          position: {
            x: obj.position.x,
            y: obj.position.y,
            z: obj.position.z
          },
          worldPosition: {
            x: worldPos.x,
            y: worldPos.y,
            z: worldPos.z
          },
          rotation: {
            x: obj.rotation.x,
            y: obj.rotation.y,
            z: obj.rotation.z
          },
          scale: {
            x: obj.scale.x,
            y: obj.scale.y,
            z: obj.scale.z
          }
        })
      }
      if (obj instanceof THREE.Mesh) {
        if (isWireframe) {
          // Wireframe model: keep visible for Rapier but fully transparent
          obj.visible = true
          obj.castShadow = false
          obj.receiveShadow = false
          obj.renderOrder = -1
          // Make material fully transparent
          if (obj.material) {
            const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
            materials.forEach((mat) => {
              mat.opacity = 0
              mat.transparent = true
              mat.depthWrite = false
            })
          }
        } else {
          // Visual models: visible with shadows
          obj.castShadow = true
          obj.receiveShadow = true
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat) => {
                mat.envMapIntensity = 1
                mat.needsUpdate = true
              })
            } else {
              obj.material.envMapIntensity = 1
              obj.material.needsUpdate = true
            }
          }

          // Ceiling double-sided rendering for reflections
          if (obj.name.toLowerCase().includes('ceiling') || obj.position.y > 3) {
            if (obj.material) {
              const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
              materials.forEach((mat) => {
                mat.side = THREE.DoubleSide
                mat.needsUpdate = true
              })
            }
          }

          // String light emissive glow
          if (obj.name.toLowerCase().includes('light') && obj.material) {
            console.log(`Applying emissive glow to ${obj.name}`)
            if (Array.isArray(obj.material)) {
              obj.material.forEach((mat) => {
                mat.emissive = new THREE.Color('#f6ffc4')
                mat.emissiveIntensity = 2
                mat.needsUpdate = true
              })
            } else {
              obj.material.emissive = new THREE.Color('#f6ffc4')
              obj.material.emissiveIntensity = 2
              obj.material.needsUpdate = true
            }
          }
        }
      }
    })

    // Auto-center on Y=0 (only for visual models)
    if (!isWireframe) {
      const box = new THREE.Box3().setFromObject(clone)
      const yOffset = -box.min.y
      clone.position.y = yOffset
    }

    // Report detected stages
    if (stages.length > 0 && onStagesDetected) {
      onStagesDetected(stages)
    }

    return clone
  }, [gltf.scene, isWireframe, onStagesDetected])

  if (isWireframe) {
    return (
      <RigidBody type="fixed" colliders="trimesh" friction={1}>
        <primitive object={clonedScene} />
      </RigidBody>
    )
  }

  return <primitive object={clonedScene} />
}

// Preload function with DRACO support
export function preloadModel(url: string) {
  const loader = new GLTFLoader()
  const dracoLoader = configureDracoLoader()
  loader.setDRACOLoader(dracoLoader)

  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })
}
