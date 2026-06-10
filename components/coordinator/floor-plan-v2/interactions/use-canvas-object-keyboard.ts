'use client'

import { useEffect } from 'react'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'

/**
 * Keyboard focus for booth objects on the canvas — Tab between booths,
 * Enter/Space to select, arrows delegate to selection nudge hook.
 */
export function useCanvasObjectKeyboard(
  store: FloorPlanDocStore,
  options?: {
    enabled?: boolean
    onSelectBooth?: (objectId: string) => void
  }
) {
  const enabled = options?.enabled ?? true

  useEffect(() => {
    if (!enabled) return

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const objectId = target?.getAttribute('data-object-id')
      if (!objectId) return

      const obj = store.doc.objects.find((o) => o.id === objectId)
      if (!obj || obj.kind !== 'booth') return

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        store.setSelection([objectId])
        options?.onSelectBooth?.(objectId)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, options, store])
}
