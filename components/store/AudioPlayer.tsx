'use client'
import { useState, useRef, useEffect } from 'react'
import { HiVolumeUp, HiVolumeOff } from 'react-icons/hi'

export function AudioPlayer() {
  const [isMuted, setIsMuted] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {
        // Auto-play blocked, will play on user interaction
      })
    }
  }, [])

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  return (
    <>
      <audio ref={audioRef} loop>
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
