'use client'
import { useMemo, useState, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useLoader } from '@react-three/fiber'
import { RigidBody } from '@react-three/rapier'
import type { ModelFile } from './hooks/useStoreConfig'

// Configure DRACO loader globally
const configureDracoLoader = () => {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  return dracoLoader
}

type ModelLoaderProps = {
  files: ModelFile[]
  onModelsLoaded?: () => void
  onProgress?: (loaded: number) => void
}

export function ModelLoader({ files, onModelsLoaded, onProgress }: ModelLoaderProps) {
  const [loadedCount, setLoadedCount] = useState(0)

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
      onModelsLoaded?.()
    }
  }, [loadedCount, sortedFiles.length, onModelsLoaded])

  return (
    <>
      {sortedFiles.map((file, idx) => (
        <Model
          key={file.url}
          url={file.url}
          isWireframe={file.priority === 0}
          onLoaded={handleModelLoaded}
        />
      ))}
    </>
  )
}



type ModelProps = {
  url: string
  isWireframe: boolean
  onLoaded?: () => void
}

function Model({ url, isWireframe, onLoaded }: ModelProps) {
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

    clone.traverse((obj) => {
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

    return clone
  }, [gltf.scene, isWireframe])

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
