'use client'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function usePOVCamera() {
  const { camera, gl } = useThree()
  const targetYaw = useRef(0)
  const targetPitch = useRef(0)
  const currentYaw = useRef(0)
  const currentPitch = useRef(0)
  const isDragging = useRef(false)
  const previousMouse = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = gl.domElement

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true
      previousMouse.current = { x: e.clientX, y: e.clientY }
      canvas.setPointerCapture(e.pointerId)
    }

    const onPointerUp = (e: PointerEvent) => {
      isDragging.current = false
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current) return

      const deltaX = e.clientX - previousMouse.current.x
      const deltaY = e.clientY - previousMouse.current.y

      const sensitivity = 0.002
      targetYaw.current += deltaX * sensitivity
      targetPitch.current += deltaY * sensitivity

      // Clamp pitch to prevent flipping
      targetPitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, targetPitch.current))

      previousMouse.current = { x: e.clientX, y: e.clientY }
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [gl])

  useFrame((_, delta) => {
    // Smooth damping factor (higher = snappier, lower = smoother)
    const dampingFactor = 15
    const t = 1 - Math.exp(-dampingFactor * delta)

    // Lerp current rotation towards target
    currentYaw.current += (targetYaw.current - currentYaw.current) * t
    currentPitch.current += (targetPitch.current - currentPitch.current) * t

    // Apply smoothed rotation to camera
    const euler = new THREE.Euler(currentPitch.current, currentYaw.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)
  })
}
