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
      position={[0, 1, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={1024}
        mixBlur={1}
        mixStrength={mixStrength * 14}
        blur={[blur * 600, blur * 120]}
        mirror={0}
        depthScale={1.1}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        roughness={roughness}
        metalness={.6}
        color="#0e0f12"
      />
    </mesh>
  )
}
