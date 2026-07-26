'use client'

import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2, Object3D } from 'three'

export interface ProductData {
  id: number
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

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Normalize pointer coordinates
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.current.y = -(event.clientY / window.innerHeight) * 2 + 1

      // Update raycaster
      raycaster.current.setFromCamera(pointer.current, camera)

      // Find intersections, exclude glass vitrins
      const intersects = raycaster.current.intersectObjects(scene.children, true)
        .filter(intersect => !intersect.object.name.toLowerCase().includes('vitrin'))

      if (intersects.length > 0) {
        // Get clicked object
        let targetObject: Object3D | null = intersects[0].object

        // Search up the hierarchy for userData.productId
        let foundProduct: ProductData | null = null
        while (targetObject && !foundProduct) {
          if (targetObject.userData?.productId) {
            // Find product by ID
            foundProduct = productsList.find(p => p.id === targetObject?.userData?.productId) || null
            break
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
  }, [camera, scene, gl, productsList, onProductClick])

  return null
}
