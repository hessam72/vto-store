'use client'
import { useFrame } from '@react-three/fiber'
import { useRef, useEffect } from 'react'
import * as THREE from 'three'

interface CameraTransitionProps {
  isTransitioning: boolean
  targetPosition: [number, number, number]
  duration?: number
}

export function CameraTransition({
  isTransitioning,
  targetPosition,
  duration = 4000
}: CameraTransitionProps) {
  const startPos = useRef<THREE.Vector3 | null>(null)
  const startTime = useRef<number>(0)
  const isDone = useRef(false)

  useEffect(() => {
    if (isTransitioning && !isDone.current) {
      startTime.current = Date.now()
    }
  }, [isTransitioning])

  useFrame(({ camera }) => {
    if (!isTransitioning || isDone.current) return

    // Store initial position
    if (!startPos.current) {
      startPos.current = new THREE.Vector3(
        targetPosition[0],
        targetPosition[1] + 10,
        targetPosition[2] + 12
      )
      camera.position.copy(startPos.current)
      return
    }

    const elapsed = Date.now() - startTime.current
    const progress = Math.min(elapsed / duration, 1)

    // Smooth easing (easeOutCubic)
    const eased = 1 - Math.pow(1 - progress, 3)

    // Lerp camera position
    camera.position.lerpVectors(
      startPos.current,
      new THREE.Vector3(...targetPosition),
      eased
    )

    if (progress >= 1) {
      isDone.current = true
    }
  })

  return null
}
