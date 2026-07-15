'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { GetStoreBySlugResponse, APIProduct } from '@/types/api'
import type { ProductData } from '../ProductInteraction'

export type ModelFile = {
  priority: number
  quality: 'low' | 'high'
  url: string
}

export type StoreConfig = {
  id: string
  files: ModelFile[]
}

function transformAPIToStoreConfig(response: GetStoreBySlugResponse): StoreConfig {
  const { store } = response

  // Map gallery.threeDFiles to ModelFile[]
  const files: ModelFile[] = store.gallery.threeDFiles.map((file) => ({
    url: file.url,
    priority: 1, // API doesn't provide priority, default to 1
    quality: 'high' as const // API doesn't provide quality, default to high
  }))

  return {
    id: store.slug,
    files
  }
}

function transformAPIToProducts(apiProducts: APIProduct[]): ProductData[] {
  return apiProducts.map((product) => ({
    category: product.stage.code,
    variant: product.title,
    price: product.construction_fee.toString(),
    weight: product.weight.toString(),
    name_fa: product.title,
    glbPath: product.threeDFile.url
  }))
}

export function useStoreConfig() {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [products, setProducts] = useState<ProductData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const slug = searchParams.get('slug') || null

    // Build API URL - if no slug, backend returns default store
    const apiUrl = slug
      ? `/api/next-api/get-store-by-slug?slug=${slug}`
      : '/api/next-api/get-store-by-slug'

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error('Store not found')
        }
        return res.json()
      })
      .then((data: GetStoreBySlugResponse) => {
        const storeConfig = transformAPIToStoreConfig(data)
        const productData = transformAPIToProducts(data.store.products)

        setConfig(storeConfig)
        setProducts(productData)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [searchParams])

  return { config, products, loading, error }
}
