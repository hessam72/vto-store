'use client'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { usePhysics } from './PhysicsSystem'
import { useJoystickControls } from './Joystick'

const GRAVITY = 30 // units/second²

export function usePlayerPhysics(physics: ReturnType<typeof usePhysics>) {
  const damping = useRef(0)

  useFrame((state, delta) => {
    if (!physics.octreeReady.current) return

    const { playerVelocity, playerOnFloor, playerCollider } = physics

    // Apply gravity when airborne
    if (!playerOnFloor.current) {
      playerVelocity.current.y -= GRAVITY * delta
    }

    // Apply damping (friction/air resistance)
    damping.current = Math.exp(-4 * delta) - 1
    playerVelocity.current.addScaledVector(
      playerVelocity.current,
      damping.current
    )

    // Move capsule by velocity
    const deltaPosition = playerVelocity.current.clone().multiplyScalar(delta)
    playerCollider.current.translate(deltaPosition)

    // Update camera position to follow capsule
    state.camera.position.copy(playerCollider.current.end)

    // Safety: teleport if fallen through floor
    if (state.camera.position.y < -5) {
      playerCollider.current.start.set(0, 0.55, 0)
      playerCollider.current.end.set(0, 1.75, 9)
      state.camera.position.copy(playerCollider.current.end)
      playerVelocity.current.set(0, 0, 0)
    }
  })
}

export function usePlayerController(physics: ReturnType<typeof usePhysics>) {
  const { updateMovement, setJoystickInput } = useJoystickControls(physics.playerVelocity)

  usePlayerPhysics(physics)

  useFrame((state, delta) => {
    // Apply WASD/joystick input
    updateMovement(delta)
  })

  return { setJoystickInput }
}
