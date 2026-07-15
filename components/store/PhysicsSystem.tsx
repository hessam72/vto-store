'use client'
import { useRef } from 'react'
import type { RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

export function usePhysics() {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const playerVelocity = useRef(new THREE.Vector3())
  const playerOnFloor = useRef(true)

  return {
    rigidBodyRef,
    playerVelocity,
    playerOnFloor,
  }
}
