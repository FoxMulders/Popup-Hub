'use client'

import { useEffect, useRef } from 'react'
import { formatCents } from '@/lib/square/client'

interface PotCounterProps {
  totalCents: number
  animated?: boolean
}

export function PotCounter({ totalCents, animated = true }: PotCounterProps) {
  const displayRef = useRef<HTMLSpanElement>(null)
  const prevRef = useRef(totalCents)

  useEffect(() => {
    if (!animated || !displayRef.current) return
    const start = prevRef.current
    const end = totalCents
    if (start === end) return

    const duration = 600
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(start + (end - start) * eased)
      if (displayRef.current) {
        displayRef.current.textContent = formatCents(current)
      }
      if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
    prevRef.current = end
  }, [totalCents, animated])

  return (
    <span
      ref={displayRef}
      className="tabular-nums font-mono"
    >
      {formatCents(totalCents)}
    </span>
  )
}
