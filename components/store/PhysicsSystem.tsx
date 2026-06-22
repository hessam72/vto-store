'use client'
import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Octree } from 'three/examples/jsm/math/Octree.js'
import { Capsule } from 'three/examples/jsm/math/Capsule.js'
import * as THREE from 'three'

export function usePhysics() {
  const { scene } = useThree()
  const worldOctree = useRef(new Octree())
  const playerCollider = useRef(
    new Capsule(
      new THREE.Vector3(0, 0.55, 0),  // Bottom
      new THREE.Vector3(0, 1.75, 9),  // Top (player eye height ~1.8m)
      0.35                             // Radius
    )
  )
  const playerVelocity = useRef(new THREE.Vector3())
  const playerOnFloor = useRef(false)

  // Build octree after mount (models should be in scene by now)
  useEffect(() => {
    // Small delay to ensure models are in scene.children
    const timer = setTimeout(() => {
      console.log('Building collision octree...')
      console.log('Scene children before build:', scene.children.length)

      // Find and use ONLY the wireframe model (first GLB, priority 0)
      let wireframeFound = false
      scene.traverse((obj) => {
        if (obj.userData.isWireframeCollision && !wireframeFound) {
          console.log('Building octree from wireframe model only')
          worldOctree.current.fromGraphNode(obj)
          wireframeFound = true
        }
      })

      if (!wireframeFound) {
        console.warn('No wireframe collision model found! Physics may not work.')
      } else {
        console.log('Octree built successfully from wireframe')
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [scene])

  // Collision detection every frame
  useFrame((state, delta) => {
    const result = worldOctree.current.capsuleIntersect(playerCollider.current)
    playerOnFloor.current = false

    if (result) {
      // Check if collision is with floor (normal pointing up)
      playerOnFloor.current = result.normal.y > 0

      if (!playerOnFloor.current) {
        // Wall collision: remove velocity component into wall
        playerVelocity.current.addScaledVector(
          result.normal,
          -result.normal.dot(playerVelocity.current)
        )
      }

      // Push capsule out of collision
      playerCollider.current.translate(
        result.normal.multiplyScalar(result.depth)
      )
    }
  })

  return {
    worldOctree,
    playerCollider,
    playerVelocity,
    playerOnFloor,
  }
}
