'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { ProductData } from './ProductInteraction'
import ARButton from './ARButton'
import type { Category } from '@/app/vto/models-config'

const ProductViewer3D = dynamic(() => import('./ProductViewer3D'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-gradient-to-br from-slate-900 to-black rounded-xl">
      <div className="animate-pulse text-amber-400/50 text-sm font-[family-name:var(--font-vazir)]">
        در حال بارگذاری...
      </div>
    </div>
  )
})

interface ProductPopupProps {
  product: ProductData | null
  onClose: () => void
}

export default function ProductPopup({ product, onClose }: ProductPopupProps) {
  // Close on ESC key
  useEffect(() => {
    if (!product) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [product, onClose])

  if (!product) return null

  const vtoUrl = `/vto/${product.category}${product.variant !== 'default' ? `?model=${product.variant}` : ''}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[90%] max-w-2xl max-h-[90vh] bg-black rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-amber-600/30"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 text-amber-500/60 hover:text-amber-400 transition-colors bg-black/50 rounded-full p-2 backdrop-blur-sm"
          aria-label="بستن"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* 3D Viewer */}
        <div className="h-[400px] w-full">
          <ProductViewer3D glbPath={product.glbPath} />
        </div>

        {/* Product Info */}
        <div style={{padding:'1rem'}} className="p-6 space-y-4 font-[family-name:var(--font-vazir)] bg-gradient-to-b from-black to-slate-950">
          <h2 className="text-2xl font-bold text-amber-300">{product.name_fa}</h2>

          <div className="flex gap-6 items-center">
            <div className="flex items-center gap-2">
              <span className="text-amber-200/70 text-sm">قیمت:</span>
              <span className="text-lg font-semibold text-amber-300">{product.price} تومان</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-amber-200/70 text-sm">وزن:</span>
              <span className="text-amber-100">{product.weight} گرم</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* VTO Button */}
            <a
              href={vtoUrl}
              style={{    padding: '.6rem',
    marginTop: '.5rem'}}
              className="block w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-slate-900 font-bold py-3 px-6 rounded-xl text-center transition-all duration-200 shadow-lg hover:shadow-amber-600/40 transform hover:scale-[1.02]"
            >
              پرو مجازی
            </a>

            {/* AR Button */}
            {/* <div dir="ltr">
              <ARButton
                category={product.category as Category}
                modelName={product.variant}
                variant="secondary"
              />
            </div> */}
          </div>
        </div>
      </div>
    </div>
  )
}
