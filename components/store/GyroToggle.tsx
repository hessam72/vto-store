'use client'
import { useState, useEffect } from 'react'
import { MdScreenRotation, MdScreenRotationAlt } from 'react-icons/md'

interface GyroToggleProps {
  onGyroChange: (enabled: boolean) => void
}

export function GyroToggle({ onGyroChange }: GyroToggleProps) {
  const [isGyroEnabled, setIsGyroEnabled] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [permissionState, setPermissionState] = useState<'granted' | 'denied' | 'prompt'>('prompt')

  useEffect(() => {
    // Check if DeviceOrientationEvent is supported
    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      setIsSupported(true)
    }
  }, [])

  const requestPermission = async () => {
    if (!isSupported) return

    try {
      // iOS 13+ requires explicit permission
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        const permission = await (DeviceOrientationEvent as any).requestPermission()
        setPermissionState(permission)

        if (permission === 'granted') {
          setIsGyroEnabled(true)
          onGyroChange(true)
        } else {
          alert('Gyroscope permission denied')
        }
      } else {
        // Non-iOS or older browsers - permission not required
        setPermissionState('granted')
        setIsGyroEnabled(true)
        onGyroChange(true)
      }
    } catch (error) {
      console.error('Error requesting device orientation permission:', error)
      alert('Failed to enable gyroscope controls')
    }
  }

  const toggleGyro = () => {
    if (isGyroEnabled) {
      setIsGyroEnabled(false)
      onGyroChange(false)
    } else {
      requestPermission()
    }
  }

  // Don't render on desktop or unsupported devices
  if (!isSupported) return null

  return (
    <button
      onClick={toggleGyro}
      // style={{opacity:'0.04'}}
      className={`fixed top-4 right-4 z-50 text-white p-3 rounded-full transition-colors ${
        isGyroEnabled
          ? 'bg-yellow-500/70 hover:bg-yellow-600/80'
          : 'bg-black/50 hover:bg-black/70'
      }`}
      aria-label={isGyroEnabled ? 'Disable gyroscope controls' : 'Enable gyroscope controls'}
    >
      {isGyroEnabled ? <MdScreenRotationAlt size={24} /> : <MdScreenRotation size={24} />}
    </button>
  )
}
