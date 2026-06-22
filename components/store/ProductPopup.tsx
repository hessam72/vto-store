'use client'

import { useEffect } from 'react'
import type { ProductData } from './ProductInteraction'

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
        className="relative w-[90%] max-w-md bg-black rounded-2xl shadow-2xl p-6 animate-in fade-in zoom-in duration-200 border border-amber-600/30"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-amber-500/60 hover:text-amber-400 transition-colors"
          aria-label="بستن"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        <div className="space-y-4 font-[family-name:var(--font-vazir)]">
          <h2 className="text-2xl font-bold text-amber-300 mb-6">{product.name_fa}</h2>

          <div className="space-y-3">
            <div className="flex justify-between items-center border-b border-amber-600/20 pb-2">
              <span className="text-amber-200/70">قیمت:</span>
              <span className="text-xl font-semibold text-amber-300">{product.price} تومان</span>
            </div>

            <div className="flex justify-between items-center border-b border-amber-600/20 pb-2">
              <span className="text-amber-200/70">وزن:</span>
              <span className="text-lg text-amber-100">{product.weight} گرم</span>
            </div>

            <div className="flex justify-between items-center pb-2">
              <span className="text-amber-200/70">دسته‌بندی:</span>
              <span className="text-lg text-amber-100">
                {product.category === 'earrings' ? 'گوشواره' :
                 product.category === 'necklace' ? 'گردنبند' :
                 product.category === 'rings' ? 'انگشتر' :
                 product.category === 'watch' ? 'ساعت' : product.category}
              </span>
            </div>
          </div>

          {/* VTO Button */}
          <a
            href={vtoUrl}
            className="block w-full mt-6 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-slate-900 font-bold py-3 px-6 rounded-xl text-center transition-all duration-200 shadow-lg hover:shadow-amber-600/40 transform hover:scale-[1.02]"
          >
            پرو مجازی
          </a>
        </div>
      </div>
    </div>
  )
}
