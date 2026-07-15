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
}

export default function ProductInteraction({ onProductClick }: ProductInteractionProps) {
  const { camera, scene, gl } = useThree()
  const raycaster = useRef(new Raycaster())
  const pointer = useRef(new Vector2())
  const [products, setProducts] = useState<Record<string, ProductData>>({})

  // Load products config
  useEffect(() => {
    fetch('/config/products.json')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error('Failed to load products:', err))
  }, [])

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
