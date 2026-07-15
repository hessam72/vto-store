/**
 * Device detection utilities for AR support
 */

export function getUserAgent(): string {
  if (typeof window === 'undefined') return ''
  return navigator.userAgent || ''
}

export function isMobile(): boolean {
  const ua = getUserAgent()
  return /Mobi|Android|iPhone|iPad|iPod/.test(ua)
}

export function isIOS(): boolean {
  const ua = getUserAgent()
  return /iPhone|iPad|iPod/.test(ua)
}

export function isAndroid(): boolean {
  const ua = getUserAgent()
  return /Android/.test(ua)
}

export function isARCapable(): boolean {
  return isIOS() || isAndroid()
}

export function getPlatformName(): string {
  if (isIOS()) return 'iOS'
  if (isAndroid()) return 'Android'
  return 'Desktop'
}

export function getARModeName(): string {
  if (isIOS()) return 'Quick Look'
  if (isAndroid()) return 'Scene Viewer'
  return 'Not Available'
}
