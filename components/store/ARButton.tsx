'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isARCapable, getARModeName } from '@/lib/device-utils'
import { getARPageUrl } from '@/lib/ar-config'
import type { Category } from '@/app/vto/models-config'

interface ARButtonProps {
  category: Category
  modelName?: string
  className?: string
  variant?: 'primary' | 'secondary'
}

export default function ARButton({
  category,
  modelName,
  className = '',
  variant = 'primary'
}: ARButtonProps) {
  const router = useRouter()
  const [arSupported, setArSupported] = useState(false)
  const [arMode, setArMode] = useState('')
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    const supported = isARCapable()
    setArSupported(supported)
    if (supported) {
      setArMode(getARModeName())
    }
  }, [])

  const handleClick = () => {
    if (!arSupported) return

    setIsNavigating(true)
    const url = getARPageUrl(category, modelName)
    router.push(url)
  }

  // Don't render if AR not supported
  if (!arSupported) {
    return (
      <div className={`relative group ${className}`}>
        <button
          disabled
          className={`w-full px-4 py-3 rounded-lg font-semibold transition-all opacity-50 cursor-not-allowed ${
            variant === 'primary'
              ? 'bg-gray-600 text-gray-300'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
              />
            </svg>
            AR Not Available
          </div>
        </button>

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          Available on iOS and Android devices
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={isNavigating}
      className={`w-full px-4 py-3 rounded-lg font-semibold transition-all transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
        variant === 'primary'
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg'
          : 'bg-white hover:bg-gray-100 text-black border-2 border-gray-200'
      } ${className}`}
    >
      {isNavigating ? (
        <div className="flex items-center justify-center gap-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          Launching AR...
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <span>View in AR</span>
          {arMode && (
            <span className="text-xs opacity-75">({arMode})</span>
          )}
        </div>
      )}
    </button>
  )
}
