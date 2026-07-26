'use client'
import { useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useLoader } from '@react-three/fiber'
import type { ProductData } from './ProductInteraction'
import type { StagePosition } from '@/types/api'

const configureDracoLoader = () => {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco/')
  return dracoLoader
}

type ProductLoaderProps = {
  products: ProductData[]
  stagePositions: StagePosition[]
}

export function ProductLoader({ products, stagePositions }: ProductLoaderProps) {
  // Create a map of stage codes to positions for O(1) lookup
  const stageMap = useMemo(() => {
    const map = new Map<string, StagePosition>()
    stagePositions.forEach(stage => map.set(stage.name, stage))
    return map
  }, [stagePositions])

  // Filter products that have matching stages
  const placedProducts = useMemo(() => {
    return products
      .map(product => {
        const stage = stageMap.get(product.category)
        if (!stage) {
          console.warn(`⚠️ Product "${product.variant}" has stage "${product.category}" but no matching stage position found`)
          return null
        }
        return { product, stage }
      })
      .filter(Boolean) as Array<{ product: ProductData; stage: StagePosition }>
  }, [products, stageMap])

  useEffect(() => {
    if (placedProducts.length > 0) {
      console.log(`✅ Placing ${placedProducts.length} products on stages`)
    }
  }, [placedProducts])

  return (
    <>
      {placedProducts.map(({ product, stage }, index) => (
        <ProductModel
          key={`${product.glbPath}-${stage.name}-${index}`}
          product={product}
          position={stage.worldPosition}
        />
      ))}
    </>
  )
}

type ProductModelProps = {
  product: ProductData
  position: { x: number; y: number; z: number }
}

function ProductModel({ product, position }: ProductModelProps) {
  const gltf = useLoader(GLTFLoader, product.glbPath, (loader) => {
    const dracoLoader = configureDracoLoader()
    loader.setDRACOLoader(dracoLoader)
  })

  const clonedScene = useMemo(() => {
    const clone = gltf.scene.clone(true)

    // Auto-center: center X/Z, align bottom to Y=0
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())

    clone.position.set(
      -center.x + position.x,
      -box.min.y + position.y+.4,
      -center.z + position.z
    )

    // Apply transforms to meshes
    clone.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.castShadow = true
        obj.receiveShadow = true
        obj.userData.productId = product.id

        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((mat) => {
            mat.envMapIntensity = 1
            mat.needsUpdate = true
          })
        }
      }
    })

    return clone
  }, [gltf.scene, position])

  return <primitive object={clonedScene} />
}
