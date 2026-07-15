'use client'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'

interface ParticleRevealProps {
  isTransitioning: boolean
  duration?: number
  count?: number
}

export function ParticleReveal({
  isTransitioning,
  duration = 4000,
  count = 1500
}: ParticleRevealProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const startTime = useRef<number>(0)
  const isDone = useRef(false)

  // Generate random positions and velocities
  const particles = useMemo(() => {
    const positions: THREE.Vector3[] = []
    const velocities: THREE.Vector3[] = []

    for (let i = 0; i < count; i++) {
      // Start within viewport
      positions.push(new THREE.Vector3(
        (Math.random() - 0.5) * 20,
        Math.random() * 10,
        (Math.random() - 0.5) * 20
      ))

      // Outward velocity
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      ))
    }

    return { positions, velocities }
  }, [count])

  useEffect(() => {
    if (isTransitioning) {
      startTime.current = Date.now()
      isDone.current = false
    }
  }, [isTransitioning])

  useFrame(() => {
    if (!isTransitioning || !meshRef.current || isDone.current) return

    const elapsed = Date.now() - startTime.current
    const progress = Math.min(elapsed / duration, 1)

    // Fade + disperse
    const matrix = new THREE.Matrix4()
    const color = new THREE.Color()

    for (let i = 0; i < count; i++) {
      const pos = particles.positions[i]
      const vel = particles.velocities[i]

      // Move outward
      pos.add(vel.clone().multiplyScalar(1 - progress))

      // Scale down
      const scale = (1 - progress) * 0.03

      matrix.compose(pos, new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale))
      meshRef.current.setMatrixAt(i, matrix)

      // Fade color (amber to transparent)
      color.setHex(0xffb300)
      meshRef.current.setColorAt(i, color.multiplyScalar(1 - progress))
    }

    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }

    if (progress >= 1) {
      isDone.current = true
      meshRef.current.visible = false
    }
  })

  if (!isTransitioning) return null

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.8} />
    </instancedMesh>
  )
}
