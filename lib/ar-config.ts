import { Category, getARModelPaths } from '@/app/vto/models-config'

export interface ARModelPaths {
  glb: string
  usdz: string
}

/**
 * Get AR model paths for a specific product
 */
export function getProductARPaths(category: Category, modelName?: string): ARModelPaths | null {
  return getARModelPaths(category, modelName)
}

/**
 * Generate AR page URL
 */
export function getARPageUrl(category: Category, modelName?: string): string {
  const name = modelName || 'default'
  return `/ar/${category}/${name}`
}

/**
 * Check if AR is supported on current device
 */
export function isARSupported(): boolean {
  if (typeof window === 'undefined') return false

  const ua = navigator.userAgent || ''
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)

  return isIOS || isAndroid
}
