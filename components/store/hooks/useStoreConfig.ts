'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
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
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL

  // Map gallery.three_d_files to ModelFile[]
  // Files without priority/quality = main files (auto-increment priority, default quality)
  let autoPriority = 1
  const files: ModelFile[] = store.gallery.three_d_files.map((file) => ({
    url: `${baseUrl}/storage/${file.url}`,
    priority: file.priority ?? autoPriority++,
    quality: file.quality ?? 'high'
  }))

  return {
    id: store.slug,
    files
  }
}

function transformAPIToProducts(apiProducts: APIProduct[]): ProductData[] {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL

  return apiProducts.map((product) => ({
    id: product.id,
    category: product.stage.code,
    variant: product.title,
    price: product.construction_fee.toString(),
    weight: product.weight.toString(),
    name_fa: product.title,
    glbPath: `${baseUrl}/storage/${product.three_d_file.url}`
  }))
}

function extractStages(response: GetStoreBySlugResponse): string[] {
  return response.store.gallery.stages.map((stage) => stage.code)
}

export function useStoreConfig() {
  const params = useParams()
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [products, setProducts] = useState<ProductData[]>([])
  const [stages, setStages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Get slug from URL path or use default from env
    const slugFromPath = Array.isArray(params.slug) ? params.slug[0] : params.slug
    const slug = slugFromPath || process.env.NEXT_PUBLIC_DEFAULT_STORE_SLUG || null

    // Check if gallery=1 query param exists
    const isGalleryMode = searchParams.get('gallery') == '1'

    // Build API URL
    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL
    const endpoint = isGalleryMode ? '/api/next-api/get-gallery-by-slug' : '/api/next-api/get-store-by-slug'
    const apiUrl = `${baseUrl}${endpoint}`

    // POST request with slug in body
    fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ slug })
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(isGalleryMode ? 'Gallery not found' : 'Store not found')
        }
        return res.json()
      })
      .then((data: GetStoreBySlugResponse) => {
        const storeConfig = transformAPIToStoreConfig(data)
        const productData = transformAPIToProducts(data.store.products)
        const stageList = extractStages(data)

        setConfig(storeConfig)
        setProducts(productData)
        setStages(stageList)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [params, searchParams])

  return { config, products, stages, loading, error }
}
