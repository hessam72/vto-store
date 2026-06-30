'use client'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { usePhysics } from './PhysicsSystem'
import { useJoystickControls } from './Joystick'
import { useRef } from 'react'

export function usePlayerPhysics(physics: ReturnType<typeof usePhysics>) {
  const initTime = useRef(Date.now())
  const isInitialized = useRef(false)

  useFrame((state, delta) => {
    const { rigidBodyRef, playerVelocity } = physics

    if (!rigidBodyRef.current) return

    // Grace period: keep camera locked for first 200ms to prevent fall-through
    const elapsed = Date.now() - initTime.current
    if (elapsed < 800) {
      if (!isInitialized.current) {
        rigidBodyRef.current.setTranslation({ x: 0, y: 1.15, z: 5 }, true)
        rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
        state.camera.position.set(0, 2.5, 5)
      }
      return
    }
    isInitialized.current = true

    // Get current velocity from Rapier
    const currentVel = rigidBodyRef.current.linvel()
    playerVelocity.current.set(currentVel.x, currentVel.y, currentVel.z)

    // Update camera to follow rigid body with offset
    const pos = rigidBodyRef.current.translation()
    state.camera.position.set(pos.x, pos.y + .9, pos.z)

    // Safety: teleport if fallen
    if (pos.y < -5) {
      rigidBodyRef.current.setTranslation({ x: 0, y: 1.6, z: 5 }, true)
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      state.camera.position.set(0, 2.5, 5)
    }
  })
}

export function usePlayerController(physics: ReturnType<typeof usePhysics>) {
  const { updateMovement, setJoystickInput } = useJoystickControls(physics.playerVelocity)

  usePlayerPhysics(physics)

  useFrame((state, delta) => {
    const { rigidBodyRef, playerVelocity } = physics
    if (!rigidBodyRef.current) return

    // Apply WASD/joystick input
    updateMovement(delta)

    // Apply computed velocity to Rapier rigid body
    rigidBodyRef.current.setLinvel(
      {
        x: playerVelocity.current.x,
        y: rigidBodyRef.current.linvel().y, // Preserve gravity Y
        z: playerVelocity.current.z
      },
      true
    )
  })

  return { setJoystickInput }
}
