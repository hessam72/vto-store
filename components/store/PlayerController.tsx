'use client'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { usePhysics } from './PhysicsSystem'
import { useJoystickControls } from './Joystick'

export function usePlayerPhysics(physics: ReturnType<typeof usePhysics>) {
  useFrame((state, delta) => {
    const { rigidBodyRef, playerVelocity } = physics

    if (!rigidBodyRef.current) return

    // Get current velocity from Rapier
    const currentVel = rigidBodyRef.current.linvel()
    playerVelocity.current.set(currentVel.x, currentVel.y, currentVel.z)

    // Update camera to follow rigid body
    const pos = rigidBodyRef.current.translation()
    state.camera.position.set(pos.x, pos.y, pos.z)

    // Safety: teleport if fallen
    if (pos.y < -5) {
      rigidBodyRef.current.setTranslation({ x: 0, y: 1.6, z: 5 }, true)
      rigidBodyRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true)
      state.camera.position.set(0, 1.6, 5)
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
