'use client'

import { useEffect, useRef, useState } from 'react'
import { ConfettiBurst } from '@/components/charitable-impact/confetti-burst'
import {
  fireWinConfetti,
  playWinAudio,
  playWinHaptics,
} from '@/lib/quarter-auction/celebration-effects'

interface WinCelebrationProps {
  active: boolean
  paddleNumber: string
  itemTitle: string
  vendorName?: string
  vendorContact?: { email?: string | null; phone?: string | null }
  onDismiss: () => void
}

export function WinCelebration({
  active,
  paddleNumber,
  itemTitle,
  vendorName,
  vendorContact,
  onDismiss,
}: WinCelebrationProps) {
  const stopAudioRef = useRef<(() => void) | null>(null)
  const [flash, setFlash] = useState(false)

  useEffect(() => {
    if (!active) return

    setFlash(true)
    const flashTimer = setTimeout(() => setFlash(false), 1400)

    playWinHaptics()
    stopAudioRef.current = playWinAudio()
    void fireWinConfetti()

    const dismissTimer = setTimeout(onDismiss, 9000)

    return () => {
      clearTimeout(flashTimer)
      clearTimeout(dismissTimer)
      stopAudioRef.current?.()
    }
  }, [active, onDismiss])

  if (!active) return null

  return (
    <>
      <ConfettiBurst active pieceCount={96} />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="alertdialog"
        aria-labelledby="win-title"
        aria-describedby="win-desc"
      >
        <div
          className={`absolute inset-0 transition-colors duration-300 ${
            flash ? 'bg-yellow-300/90' : 'bg-black/75'
          }`}
          aria-hidden
        />
        <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl animate-in zoom-in-95">
          <p className="text-5xl mb-2" aria-hidden>
            🎉
          </p>
          <h2 id="win-title" className="text-2xl font-bold text-forest">
            WOO HOO! You won!
          </h2>
          <p id="win-desc" className="mt-2 text-lg font-mono font-bold">
            Paddle #{paddleNumber}
          </p>
          <p className="mt-1 text-muted-foreground">{itemTitle}</p>
          {vendorName && (
            <div className="mt-4 rounded-lg bg-sage-50 p-4 text-left text-sm">
              <p className="font-semibold">Pick up from {vendorName}</p>
              {vendorContact?.email && <p>{vendorContact.email}</p>}
              {vendorContact?.phone && <p>{vendorContact.phone}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="mt-6 w-full rounded-xl bg-forest py-3 font-semibold text-white"
          >
            Got it!
          </button>
        </div>
      </div>
    </>
  )
}
