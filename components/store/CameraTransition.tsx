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
  duration = 3400
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
        targetPosition[1] + 7,
        targetPosition[2] + 40
      )
      camera.position.copy(startPos.current)
      // Look at target from above
      camera.lookAt(targetPosition[0], targetPosition[1], targetPosition[2])
      return
    }

    const elapsed = Date.now() - startTime.current
    const progress = Math.min(elapsed / duration, 1)

    // Smooth easing (easeOutCubic)
    const eased = 1 - Math.pow(1 - progress, 3)
    // Faster Y descent (easeOutQuad - steeper curve)
    const easedY = 1 - Math.pow(1 - progress, 2)

    // Lerp camera position with faster Y descent
    const targetPos = new THREE.Vector3(...targetPosition)
    camera.position.x = THREE.MathUtils.lerp(startPos.current.x, targetPos.x, eased)
    camera.position.y = THREE.MathUtils.lerp(startPos.current.y, targetPos.y, easedY)
    camera.position.z = THREE.MathUtils.lerp(startPos.current.z, targetPos.z, eased)

    // Animate rotation: start looking down at target, end looking forward
    const startLookAt = new THREE.Vector3(...targetPosition)
    const endLookAt = new THREE.Vector3(targetPosition[0], targetPosition[1], targetPosition[2] - 5)
    const currentLookAt = new THREE.Vector3().lerpVectors(startLookAt, endLookAt, eased)
    camera.lookAt(currentLookAt)

    if (progress >= 1) {
      isDone.current = true
    }
  })

  return null
}
