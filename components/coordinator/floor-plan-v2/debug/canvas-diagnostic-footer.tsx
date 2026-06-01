'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { activeDropZoneRooms } from '../geometry/is-point-in-room'
import type { FloorPlanDoc } from '../state/types'
import { useDebugLog } from './debug-log-context'
import type { PlacesApiStatus } from './places-api-status-context'
import { formatDebugLogText } from './format-debug-log-text'

export interface CanvasDiagnosticFooterProps {
  doc: FloorPlanDoc
  placesApiStatus?: PlacesApiStatus
  className?: string
}

/**
 * Fixed "truth window" — room count, Places API status, full state export.
 */
export function CanvasDiagnosticFooter({
  doc,
  placesApiStatus = 'idle',
  className,
}: CanvasDiagnosticFooterProps) {
  const { logs, addLog } = useDebugLog()
  const [copied, setCopied] = useState(false)

  const roomCount = activeDropZoneRooms(doc).length
  const placesLabel =
    placesApiStatus === 'API_SUCCESS'
      ? 'API_SUCCESS'
      : placesApiStatus === 'API_ERROR'
        ? 'API_ERROR'
        : 'API_IDLE'

  useEffect(() => {
    addLog(`Canvas diagnostic ready — doc.rooms.length=${roomCount}`)
  }, [addLog, roomCount])

  const exportPayload = useMemo(
    () =>
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          roomCount,
          placesApiStatus: placesLabel,
          rooms: doc.rooms ?? [],
          objects: doc.objects,
          objectRoom: doc.objectRoom ?? {},
          canvasWidthFt: doc.canvasWidthFt,
          canvasLengthFt: doc.canvasLengthFt,
          eventLog: formatDebugLogText(logs),
        },
        null,
        2
      ),
    [doc, logs, placesLabel, roomCount]
  )

  const copyState = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportPayload)
      setCopied(true)
      toast.success('Canvas state JSON copied to clipboard.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed — select the preview text and copy manually.')
    }
  }, [exportPayload])

  return (
    <footer
      className={cn(
        'canvas-diagnostic-footer popup-hub-chrome-footer',
        'fixed bottom-0 left-0 right-0 z-[9999]',
        'border-t border-stone-600 bg-stone-950/98 text-stone-100 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]',
        'font-mono text-[10px] backdrop-blur-sm',
        className
      )}
      aria-label="Canvas diagnostic truth window"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Truth window
        </span>
        <span data-testid="diagnostic-room-count">
          doc.rooms.length = <strong className="text-emerald-300">{roomCount}</strong>
        </span>
        <span
          data-testid="diagnostic-places-api"
          className={cn(
            placesLabel === 'API_SUCCESS' && 'text-emerald-400',
            placesLabel === 'API_ERROR' && 'text-red-400',
            placesLabel === 'API_IDLE' && 'text-stone-500'
          )}
        >
          Places: {placesLabel}
        </span>
        <span className="text-stone-500">{logs.length} log lines</span>
        <button
          type="button"
          className="ml-auto rounded bg-emerald-700 px-3 py-1 font-sans text-[11px] font-semibold text-white hover:bg-emerald-600"
          onClick={() => void copyState()}
        >
          {copied ? 'Copied' : 'Copy Logs'}
        </button>
      </div>
      <div className="max-h-16 overflow-y-auto border-t border-stone-800 px-3 py-1 text-stone-500">
        <pre className="whitespace-pre-wrap break-all">
          {formatDebugLogText(logs).slice(-1200) || 'Waiting for geometry events…'}
        </pre>
      </div>
    </footer>
  )
}
