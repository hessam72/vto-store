'use client'
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export function usePOVCamera() {
  const { camera, gl } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)
  const isPointerLocked = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    const onClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock().catch((err) => {
          console.warn('Pointer lock failed:', err)
        })
      }
    }

    const onPointerLockChange = () => {
      isPointerLocked.current = document.pointerLockElement === canvas
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!isPointerLocked.current) return

      const sensitivity = 0.002
      yaw.current -= e.movementX * sensitivity
      pitch.current -= e.movementY * sensitivity

      // Clamp pitch to prevent flipping
      pitch.current = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch.current))
    }

    canvas.addEventListener('click', onClick)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    canvas.addEventListener('pointermove', onPointerMove)

    return () => {
      canvas.removeEventListener('click', onClick)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      canvas.removeEventListener('pointermove', onPointerMove)
    }
  }, [gl])

  useFrame(() => {
    // Apply rotation to camera
    const euler = new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)
  })
}
