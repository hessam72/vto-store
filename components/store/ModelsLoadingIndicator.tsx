'use client'
import { useState, useEffect } from 'react'

interface ModelsLoadingIndicatorProps {
  fadeOut?: boolean
  loadedCount?: number
  totalCount?: number
}

export function ModelsLoadingIndicator({
  fadeOut = false,
  loadedCount,
  totalCount
}: ModelsLoadingIndicatorProps) {
  const [opacity, setOpacity] = useState(1)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (fadeOut) {
      const fadeStart = Date.now()
      const fadeDuration = 300

      const interval = setInterval(() => {
        const elapsed = Date.now() - fadeStart
        const newOpacity = Math.max(1 - elapsed / fadeDuration, 0)
        setOpacity(newOpacity)

        if (newOpacity <= 0) {
          clearInterval(interval)
          setVisible(false)
        }
      }, 16)

      return () => clearInterval(interval)
    }
  }, [fadeOut])

  if (!visible) return null

  const showProgress = loadedCount !== undefined && totalCount !== undefined
  const percentage = showProgress ? Math.round((loadedCount / totalCount) * 100) : 0

  return (
    <div
      className="fixed inset-0 flex items-center justify-center pointer-events-none z-40 font-[family-name:var(--font-vazir)] transition-opacity duration-300"
      style={{ opacity }}
    >
      <div className="bg-black/50 backdrop-blur-sm text-white px-8 py-6 rounded-2xl text-base border border-amber-500/20 shadow-xl shadow-amber-500/10">
        <div className="flex items-center gap-4">
          {/* Loading spinner */}
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-400 border-r-yellow-500 animate-spin"></div>
          </div>
          <div className="flex flex-col gap-1">
            <span>بارگذاری مدل‌های سه‌بعدی...</span>
            {showProgress && (
              <span className="text-xs text-amber-400/80">
                {percentage}% ({loadedCount}/{totalCount})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
