'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export type ModelFile = {
  priority: number
  quality: 'low' | 'high'
  url: string
}

export type StoreConfig = {
  id: string
  files: ModelFile[]
}

export type StoresData = {
  stores: StoreConfig[]
}

export function useStoreConfig() {
  const searchParams = useSearchParams()
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const storeId = searchParams.get('id') || 'mall'

    fetch('/config/stores.json')
      .then((res) => res.json())
      .then((data: StoresData) => {
        const store = data.stores.find((s) => s.id === storeId)
        if (!store) {
          throw new Error(`Store "${storeId}" not found`)
        }
        setConfig(store)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [searchParams])

  return { config, loading, error }
}
