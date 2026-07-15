'use client'

import { useEffect, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2, Object3D } from 'three'

export interface ProductData {
  category: string
  variant: string
  price: string
  weight: string
  name_fa: string
  glbPath: string
}

interface ProductInteractionProps {
  onProductClick: (product: ProductData | null) => void
  products?: ProductData[]
}

export default function ProductInteraction({ onProductClick, products: productsList = [] }: ProductInteractionProps) {
  const { camera, scene, gl } = useThree()
  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())

  // Convert array to record for backward compatibility
  const products = productsList.reduce<Record<string, ProductData>>((acc, product) => {
    acc[product.variant.toLowerCase()] = product
    return acc
  }, {})

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Normalize pointer coordinates
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1

      // Update raycaster
      raycaster.current.setFromCamera(pointer.current, camera)

      // Find intersections
      const intersects = raycaster.current.intersectObjects(scene.children, true)

      if (intersects.length > 0) {
        // Get clicked object
        let targetObject: Object3D | null = intersects[0].object

        // Search up the hierarchy for a product name
        let foundProduct: ProductData | null = null
        while (targetObject && !foundProduct) {
          const objectName = targetObject.name.toLowerCase()

          // Check if this object matches any product
          for (const [productKey, productData] of Object.entries(products)) {
            if (objectName.includes(productKey.toLowerCase()) ||
                objectName.includes(productData.category)) {
              foundProduct = productData
              break
            }
          }

          targetObject = targetObject.parent
        }

        if (foundProduct) {
          onProductClick(foundProduct)
        }
      }
    }

    gl.domElement.addEventListener('click', handleClick)
    return () => gl.domElement.removeEventListener('click', handleClick)
  }, [camera, scene, gl, products, onProductClick])

  return null
}
