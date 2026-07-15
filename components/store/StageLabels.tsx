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
              stage.worldPosition.y + 0.5, // Offset above stage
              stage.worldPosition.z
            ]}
            follow={true}
            lockX={false}
            lockY={false}
            lockZ={false}
          >
            <Text
              fontSize={0.3}
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.02}
              outlineColor="black"
            >
              {stageNumber}
            </Text>
          </Billboard>
        )
      })}
    </>
  )
}
