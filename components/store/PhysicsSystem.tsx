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
      new THREE.Vector3(0, 0.35, 0),  // Bottom
      new THREE.Vector3(0, 1.45, 0),  // Top (player eye height ~1.6m)
      0.35                             // Radius
    )
  )
  const playerVelocity = useRef(new THREE.Vector3())
  const playerOnFloor = useRef(false)

  // Build octree once on mount
  useEffect(() => {
    console.log('Building collision octree...')
    worldOctree.current.fromGraphNode(scene)
    console.log('Octree built from', scene.children.length, 'objects')
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
