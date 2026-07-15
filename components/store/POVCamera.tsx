'use client'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface POVCameraProps {
  gyroEnabled?: boolean
}

export function usePOVCamera(props?: POVCameraProps) {
  const { gyroEnabled = false } = props || {}
  const { camera, gl } = useThree()
  const targetYaw = useRef(0)
  const targetPitch = useRef(0)
  const currentYaw = useRef(0)
  const currentPitch = useRef(0)
  const isDragging = useRef(false)
  const previousMouse = useRef({ x: 0, y: 0 })
  const previousOrientation = useRef<{ alpha: number; beta: number; gamma: number } | null>(null)

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
      if (gyroEnabled) return
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
  }, [gl, gyroEnabled])

  // Gyroscope controls
  useEffect(() => {
    if (!gyroEnabled) {
      previousOrientation.current = null
      return
    }

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha === null || event.beta === null || event.gamma === null) return

      // Initialize on first read
      if (!previousOrientation.current) {
        previousOrientation.current = {
          alpha: event.alpha,
          beta: event.beta,
          gamma: event.gamma
        }
        return // Skip first frame (no delta to calculate)
      }

      // Calculate frame-to-frame delta
      let deltaAlpha = event.alpha - previousOrientation.current.alpha
      const deltaBeta = Math.max(-10, Math.min(10, event.beta - previousOrientation.current.beta))
      const deltaGamma = Math.max(-10, Math.min(10, event.gamma - previousOrientation.current.gamma))

      // Fix alpha wraparound (compass 0°-360°)
      if (deltaAlpha > 180) deltaAlpha -= 360
      if (deltaAlpha < -180) deltaAlpha += 360

      // Update previous reference
      previousOrientation.current = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma
      }

      // Map device orientation to camera rotation
      // Beta: device tilt forward/back → camera pitch (up/down)
      // Gamma: device tilt left/right → camera yaw (left/right)
      // Alpha: compass heading → additional yaw control

      const pitchSensitivity = 0.015
      const yawSensitivity = 0.02

      // Accumulate incremental rotation
      targetPitch.current += deltaBeta * pitchSensitivity
      targetYaw.current += deltaGamma * yawSensitivity + deltaAlpha * yawSensitivity * 0.3
    }

    window.addEventListener('deviceorientation', handleOrientation)

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [gyroEnabled])

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
