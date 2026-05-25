'use client'

import { useMemo } from 'react'

interface ConfettiBurstProps {
  active: boolean
  pieceCount?: number
}

const COLORS = ['#2d6a4f', '#40916c', '#52b788', '#f4a261', '#e9c46a', '#e76f51', '#264653']

export function ConfettiBurst({ active, pieceCount = 64 }: ConfettiBurstProps) {
  const pieces = useMemo(
    () =>
      Array.from({ length: pieceCount }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.45}s`,
        duration: `${2.4 + Math.random() * 1.8}s`,
        size: 6 + Math.floor(Math.random() * 8),
        color: COLORS[i % COLORS.length],
        rotate: `${Math.random() * 360}deg`,
      })),
    [pieceCount]
  )

  if (!active) return null

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] overflow-hidden"
      aria-hidden
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="charity-confetti-piece absolute top-0 block rounded-sm opacity-90"
          style={{
            left: piece.left,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  )
}
