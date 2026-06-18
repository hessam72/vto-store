'use client'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function usePOVCamera() {
  const { camera, gl } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)
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
      yaw.current -= deltaX * sensitivity
      pitch.current -= deltaY * sensitivity

      // Clamp pitch to prevent flipping
      pitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.current))

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

  useFrame(() => {
    // Apply rotation to camera
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)
  })
}
