'use client'

import { useEffect } from 'react'
import {
  clearStoredScrollSnapshot,
  readStoredScrollSnapshot,
  restoreScrollPositions,
} from '@/lib/navigation/scroll-position'

/** Restores scroll saved by `reloadPreservingScroll` after a hard reload. */
export function ScrollRestoreOnLoad() {
  useEffect(() => {
    const snapshot = readStoredScrollSnapshot()
    if (!snapshot) return
    clearStoredScrollSnapshot()
    restoreScrollPositions(snapshot)
  }, [])

  return null
}
