'use client'
import { useRef } from 'react'
import { RigidBody, CapsuleCollider } from '@react-three/rapier'
import type { RigidBody as RigidBodyType } from '@dimforge/rapier3d-compat'
import * as THREE from 'three'

export function usePhysics() {
  const rigidBodyRef = useRef<RigidBodyType>(null)
  const playerVelocity = useRef(new THREE.Vector3())
  const playerOnFloor = useRef(true)

  return {
    rigidBodyRef,
    playerVelocity,
    playerOnFloor,
  }
}

export function PlayerRigidBody({
  rigidBodyRef
}: {
  rigidBodyRef: React.RefObject<RigidBodyType>
}) {
  return (
    <RigidBody
      ref={rigidBodyRef}
      type="dynamic"
      position={[0, 1.6, 5]}
      enabledRotations={[false, true, false]}
      lockRotations
      linearDamping={8}
      angularDamping={10}
      canSleep={false}
    >
      <CapsuleCollider args={[0.6, 0.35]} />
    </RigidBody>
  )
}
