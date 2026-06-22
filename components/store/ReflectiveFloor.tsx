import { MeshReflectorMaterial } from '@react-three/drei'

interface ReflectiveFloorProps {
  size?: number
  mixStrength?: number
  blur?: number
  roughness?: number
}

export function ReflectiveFloor({
  size = 60,
  mixStrength = 0.62,
  blur = 0.85,
  roughness = 0.62,
}: ReflectiveFloorProps) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, .42, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={2048}
        mixBlur={1}
        mixStrength={mixStrength * 34}
        // blur={[blur * 600, blur * 120]}
        mirror={1}
        depthScale={1.1}
        minDepthThreshold={.4}
        maxDepthThreshold={1.4}
        roughness={1}
        metalness={.6}
        color="#323438"
      />
    </mesh>
  )
}
