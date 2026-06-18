'use client'
import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useLoader } from '@react-three/fiber'
import type { ModelFile } from './hooks/useStoreConfig'

// Configure DRACO loader globally
const configureDracoLoader = () => {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  return dracoLoader
}

type ModelLoaderProps = {
  files: ModelFile[]
}

export function ModelLoader({ files }: ModelLoaderProps) {
  // Sort by priority (0 = wireframe first)
  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => a.priority - b.priority)
  }, [files])

  return (
    <>
      {sortedFiles.map((file, idx) => (
        <Model
          key={file.url}
          url={file.url}
          isWireframe={file.priority === 0}
        />
      ))}
    </>
  )
}

type ModelProps = {
  url: string
  isWireframe: boolean
}

function Model({ url, isWireframe }: ModelProps) {
  // Use custom loader with DRACO support
  const gltf = useLoader(GLTFLoader, url, (loader) => {
    const dracoLoader = configureDracoLoader()
    loader.setDRACOLoader(dracoLoader)
  })

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true)

    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (isWireframe) {
          // Wireframe model: invisible, used only for collision
          obj.visible = false
          obj.castShadow = false
          obj.receiveShadow = false
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
