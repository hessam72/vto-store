'use client'

import { useEffect, useRef, useState } from 'react'
import { isARCapable, getARModeName } from '@/lib/device-utils'

interface ARProductViewerProps {
  glbPath: string
  usdzPath: string
  productName: string
  poster?: string
}

export default function ARProductViewer({
  glbPath,
  usdzPath,
  productName,
  poster
}: ARProductViewerProps) {
  const modelViewerRef = useRef<HTMLElement & ModelViewerElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [arSupported, setArSupported] = useState(false)

  useEffect(() => {
    setArSupported(isARCapable())

    const mv = modelViewerRef.current
    if (!mv) return

    const handleLoadEvent = () => {
      setIsLoading(false)
      console.log('✅ AR Model loaded:', productName)
    }

    const handleErrorEvent = () => {
      setIsLoading(false)
      setError('Failed to load 3D model')
      console.error('❌ AR Model error')
    }

    mv.addEventListener('load', handleLoadEvent)
    mv.addEventListener('error', handleErrorEvent)

    return () => {
      mv.removeEventListener('load', handleLoadEvent)
      mv.removeEventListener('error', handleErrorEvent)
    }
  }, [productName])

  return (
    <div className="relative w-full h-full min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900">
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50">
          <div className="text-white text-center font-[family-name:var(--font-vazir)]" dir="rtl">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p>در حال بارگذاری {productName}...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-4 rounded-lg z-20 font-[family-name:var(--font-vazir)]" dir="rtl">
          خطا در بارگذاری مدل سه‌بعدی
        </div>
      )}

      {/* AR not supported message */}
      {!arSupported && !isLoading && (
        <div className="absolute bottom-20 left-4 right-4 bg-yellow-500/90 text-black p-4 rounded-lg z-20 text-center font-[family-name:var(--font-vazir)]" dir="rtl">
          <p className="font-semibold mb-1">واقعیت افزوده در این دستگاه فعال نیست</p>
          <p className="text-sm">شما می‌توانید مدل سه‌بعدی را مشاهده و چرخش دهید</p>
        </div>
      )}

      {/* Model Viewer */}
      <model-viewer
        ref={modelViewerRef}
        src={glbPath}
        ios-src={usdzPath}
        alt={productName}
        poster={poster}
        seamless-poster
        loading="eager"
        reveal="auto"

        // AR Configuration
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="fixed"
        ar-placement="floor"
        xr-environment

        // Visual enhancements
        camera-controls
        auto-rotate
        auto-rotate-delay={1000}
        rotation-per-second="30deg"
        shadow-intensity={1}
        shadow-softness={0.5}
        exposure={1}

        // Camera settings
        camera-orbit="0deg 75deg 0.5m"
        min-camera-orbit="auto auto 0.1m"
        max-camera-orbit="auto auto 2m"
        field-of-view="30deg"

        // Interaction
        interaction-prompt="auto"
        interaction-prompt-threshold={500}

        style={{
          width: '100%',
          height: '100%',
          minHeight: '100vh',
          position: 'absolute',
          top: 0,
          left: 0
        }}
      >
        {/* Custom AR Button */}
        {arSupported && (
          <button
            slot="ar-button"
            className="absolute top-6 left-6 px-6 py-3 bg-white hover:bg-gray-100 active:bg-gray-200 text-black font-semibold rounded-xl shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 z-30 font-[family-name:var(--font-vazir)]"
            dir="rtl"
          >
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
            مشاهده در واقعیت افزوده
          </button>
        )}

        {/* Info panel */}
        <div
          className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg font-[family-name:var(--font-vazir)]"
          slot="poster"
          dir="rtl"
        >
          <h2 className="text-xl font-bold text-gray-900 mb-2">{productName}</h2>
          <div className="text-sm text-gray-600 space-y-1">
            {arSupported && (
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                واقعیت افزوده فعال است ({getARModeName()})
              </p>
            )}
            <p>• چرخش: یک انگشت را بکشید</p>
            <p>• بزرگنمایی: با دو انگشت پینچ کنید</p>
            {arSupported && <p>• برای قرار دادن در فضای خود، روی دکمه واقعیت افزوده بزنید</p>}
          </div>
        </div>
      </model-viewer>
    </div>
  )
}
