'use client'
import { useFrame } from '@react-three/fiber'
import { useState, useEffect } from 'react'

interface SceneTransitionProps {
  isTransitioning: boolean
  onComplete: () => void
  duration?: number
}

export function SceneTransition({
  isTransitioning,
  onComplete,
  duration = 4000
}: SceneTransitionProps) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isTransitioning) {
      setProgress(0)
      return
    }

    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const newProgress = Math.min(elapsed / duration, 1)
      setProgress(newProgress)

      if (newProgress >= 1) {
        clearInterval(interval)
        onComplete()
      }
    }, 16)

    return () => clearInterval(interval)
  }, [isTransitioning, duration, onComplete])

  useFrame(({ scene }) => {
    if (!isTransitioning || progress >= 1) return

    // Smooth easing (easeOutCubic)
    const eased = 1 - Math.pow(1 - progress, 3)

    // Animate fog density: 1 → 0
    if (scene.fog && 'density' in scene.fog) {
      scene.fog.density = 0.3 * (1 - eased)
    }
  })

  // Create fog on mount
  if (isTransitioning && progress === 0) {
    return <fogExp2 attach="fog" args={['#000000', 0.3]} />
  }

  return null
}
