'use client'
import { useState, useRef, useEffect } from 'react'
import { HiVolumeUp, HiVolumeOff } from 'react-icons/hi'

export function AudioPlayer() {
  const [isMuted, setIsMuted] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    audio.volume = 0.35

    const handleCanPlay = () => {
      setIsReady(true)
      audio.play().catch(() => {
        // Auto-play blocked, will play on user interaction
      })
    }

    audio.addEventListener('canplaythrough', handleCanPlay)
    return () => audio.removeEventListener('canplaythrough', handleCanPlay)
  }, [])

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  return (
    <>
      <audio ref={audioRef} loop preload="auto">
        <source src="/audio/background.mp3" type="audio/mpeg" />
      </audio>

      <button
        onClick={toggleMute}
        className="fixed top-4 left-4 z-50 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-colors"
        aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
      >
        {isMuted ? <HiVolumeOff size={24} /> : <HiVolumeUp size={24} />}
      </button>
    </>
  )
}