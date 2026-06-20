import { SoftShadows } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'

export function ShadowSystem({
  size = 20,
  samples = 17,
  focus = 0,
}: {
  size?: number
  samples?: number
  focus?: number
}) {
  const { scene, gl } = useThree()

  // Force material update when shadow params change
  useEffect(() => {
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.material) {
        obj.material.needsUpdate = true
      }
    })
    gl.shadowMap.needsUpdate = true
  }, [size, samples, focus, scene, gl])

  return (
    <SoftShadows
      size={size}
      samples={samples}
      focus={focus}
    />
  )
}
