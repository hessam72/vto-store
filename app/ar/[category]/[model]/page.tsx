'use client'

import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { Category, getAvailableModels } from '@/app/vto/models-config'
import { getProductARPaths } from '@/lib/ar-config'

const ARProductViewer = dynamic(() => import('@/components/store/ARProductViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen bg-black flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Initializing AR...</p>
      </div>
    </div>
  )
})

export default function ARPage() {
  const params = useParams()
  const router = useRouter()
  const [modelPaths, setModelPaths] = useState<{ glb: string; usdz: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const category = params.category as Category
  const modelName = params.model as string

  useEffect(() => {
    // Validate category
    const validCategories: Category[] = ['earrings', 'necklace', 'rings', 'watch']
    if (!validCategories.includes(category)) {
      setError('Invalid product category')
      return
    }

    // Validate model name
    const availableModels = getAvailableModels(category)
    if (!availableModels.includes(modelName)) {
      setError('Product model not found')
      return
    }

    // Get AR model paths
    const paths = getProductARPaths(category, modelName)
    if (!paths) {
      setError('AR models not configured for this product')
      return
    }

    setModelPaths(paths)
  }, [category, modelName])

  const handleBack = () => {
    router.back()
  }

  if (error) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md px-4 font-[family-name:var(--font-vazir)]" dir="rtl">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-white text-2xl font-bold mb-4">خطا</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={handleBack}
            className="px-6 py-3 bg-white text-black rounded-lg font-semibold hover:bg-gray-200 transition-colors"
          >
            بازگشت
          </button>
        </div>
      </div>
    )
  }

  if (!modelPaths) {
    return (
      <div className="w-full h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center font-[family-name:var(--font-vazir)]" dir="rtl">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>در حال بارگذاری محصول...</p>
        </div>
      </div>
    )
  }

  const productDisplayName = `${category.charAt(0).toUpperCase() + category.slice(1)} - ${modelName}`

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="absolute top-6 right-6 z-50 px-4 py-2 bg-white/90 hover:bg-white active:bg-gray-100 text-black rounded-lg shadow-lg transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2 font-semibold font-[family-name:var(--font-vazir)]"
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
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        بازگشت
      </button>

      {/* AR Viewer */}
      <ARProductViewer
        glbPath={modelPaths.glb}
        usdzPath={modelPaths.usdz}
        productName={productDisplayName}
      />
    </div>
  )
}
