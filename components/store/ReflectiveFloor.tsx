import { MeshReflectorMaterial } from '@react-three/drei'
interface ReflectiveFloorProps {
  size?: number
  mixStrength?: number
  blur?: number
  roughness?: number
  opacity?: number
}

export function ReflectiveFloor({
  size = 60,
  mixStrength = 0.62,
  blur = 0.85,
  roughness = 0.62,
  opacity = 1,
}: ReflectiveFloorProps) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, .42, 0]}
      receiveShadow
    >
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        resolution={1080}
        mixBlur={0}
        mixStrength={mixStrength * 34}
        mirror={.8}
        depthScale={.4}
        minDepthThreshold={.35}
        maxDepthThreshold={1.5}
        roughness={1}
        metalness={.7}
        color="#3f3d39"
        transparent
        opacity={opacity}
      />
    </mesh>
  )
}