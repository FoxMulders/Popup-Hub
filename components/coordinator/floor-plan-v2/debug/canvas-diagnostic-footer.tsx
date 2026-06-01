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
 * Compact truth window at the bottom of the floor-plan workspace (not viewport-fixed).
 */
export function CanvasDiagnosticFooter({
  doc,
  placesApiStatus = 'idle',
  className,
}: CanvasDiagnosticFooterProps) {
  const { logs, addLog } = useDebugLog()
  const [copied, setCopied] = useState(false)
  const [logExpanded, setLogExpanded] = useState(false)

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

  const recentLogText = useMemo(() => {
    if (logs.length === 0) return ''
    return formatDebugLogText(logs.slice(0, 8))
  }, [logs])

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
        'canvas-diagnostic-footer shrink-0 border-t border-stone-600 bg-stone-950 text-stone-100',
        'font-mono text-[10px]',
        className
      )}
      aria-label="Canvas diagnostic truth window"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 py-1">
        <span className="font-sans text-[9px] font-semibold uppercase tracking-wide text-stone-400">
          Truth
        </span>
        <span data-testid="diagnostic-room-count" className="tabular-nums">
          rooms=<strong className="text-emerald-300">{roomCount}</strong>
        </span>
        <span
          data-testid="diagnostic-places-api"
          className={cn(
            placesLabel === 'API_SUCCESS' && 'text-emerald-400',
            placesLabel === 'API_ERROR' && 'text-red-400',
            placesLabel === 'API_IDLE' && 'text-stone-500'
          )}
        >
          Places:{placesLabel}
        </span>
        <span className="text-stone-500">{logs.length} lines</span>
        <button
          type="button"
          className="text-[9px] text-stone-400 underline hover:text-stone-200"
          onClick={() => setLogExpanded((v) => !v)}
          aria-expanded={logExpanded}
        >
          {logExpanded ? 'Hide log' : 'Show log'}
        </button>
        <button
          type="button"
          className="ml-auto rounded bg-emerald-700 px-2 py-0.5 font-sans text-[10px] font-semibold text-white hover:bg-emerald-600"
          onClick={() => void copyState()}
        >
          {copied ? 'Copied' : 'Copy Logs'}
        </button>
      </div>
      <div
        className={cn(
          'border-t border-stone-800 px-2 text-stone-400',
          logExpanded ? 'max-h-20 overflow-y-auto py-1' : 'max-h-5 overflow-hidden py-0.5'
        )}
      >
        <pre className="whitespace-pre-wrap break-all leading-tight">
          {recentLogText || 'Waiting for geometry events…'}
        </pre>
      </div>
    </footer>
  )
}
