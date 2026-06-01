'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { FloorPlanDoc } from '../state/types'
import type { PlacesApiStatus } from './places-api-status-context'
import { DiagnosticLogger } from './diagnostic-logger'

const LEFT_RAIL_SLOT_ID = 'layout-planner-debug-slot'

export interface DiagnosticLoggerPortalProps {
  doc: FloorPlanDoc
  placesApiStatus?: PlacesApiStatus
  enabled?: boolean
}

/**
 * Renders the diagnostic panel into the layout planner left rail slot
 * (always visible on desktop) while staying under DebugLogProvider in FloorPlanV2.
 */
export function DiagnosticLoggerPortal({
  doc,
  placesApiStatus,
  enabled = true,
}: DiagnosticLoggerPortalProps) {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const resolveSlot = () => {
      if (cancelled) return
      const el = document.getElementById(LEFT_RAIL_SLOT_ID)
      if (el) {
        setSlot(el)
        return
      }
      attempts += 1
      if (attempts < 40) {
        window.requestAnimationFrame(resolveSlot)
      }
    }

    resolveSlot()
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled || !slot) return null

  return createPortal(
    <DiagnosticLogger
      doc={doc}
      placesApiStatus={placesApiStatus}
      sectionLabel="Section 2"
      className="rounded-md border border-stone-700"
    />,
    slot
  )
}

export { LEFT_RAIL_SLOT_ID }
