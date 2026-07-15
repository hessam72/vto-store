'use client'
import { Text, Billboard } from '@react-three/drei'
import type { StagePosition } from '@/types/api'

type StageLabelsProps = {
  stages: StagePosition[]
}

export function StageLabels({ stages }: StageLabelsProps) {
  return (
    <>
      {stages.map((stage) => {
        // Extract stage number from name (e.g., "stage_3" -> "3")
        const stageNumber = stage.name.replace(/^stage_/, '')

        return (
          <Billboard
            key={stage.name}
            position={[
              stage.worldPosition.x,
              stage.worldPosition.y + 0.8, // 5% higher offset
              stage.worldPosition.z
            ]}
            follow={true}
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={0.6}
              color="#FFD700"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.03}
              outlineColor="#8B4513"
              metalness={0.9}
              roughness={0.2}
              emissive="#FFA500"
              emissiveIntensity={0.1}
            >
              {stageNumber}
            </Text>
          </Billboard>
        )
      })}
    </>
  )
}
