'use client'

import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function readReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(QUERY).matches
}

/**
 * Matches `prefers-reduced-motion: reduce` and updates when the user changes the OS setting.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return reduced
}
