'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { activeDropZoneRooms } from '../geometry/is-point-in-room'
import type { FloorPlanDoc } from '../state/types'
import { useDebugLog } from './debug-log-context'
import type { PlacesApiStatus } from './places-api-status-context'
import { formatDebugLogText } from './format-debug-log-text'

export interface DiagnosticLoggerProps {
  doc: FloorPlanDoc
  placesApiStatus?: PlacesApiStatus
  className?: string
  /** Section label for the sidebar panel (default: Section 2). */
  sectionLabel?: string
}

/**
 * Compact sidebar truth window — ~60% shorter than the legacy footer strip.
 */
export function DiagnosticLogger({
  doc,
  placesApiStatus = 'idle',
  className,
  sectionLabel = 'Section 2',
}: DiagnosticLoggerProps) {
  const { logs, addLog } = useDebugLog()
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(true)

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
    return formatDebugLogText(logs.slice(0, 12))
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
      toast.error('Copy failed — select the log text and copy manually.')
    }
  }, [exportPayload])

  return (
    <section
      className={cn(
        'diagnostic-logger shrink-0 border-t border-stone-700 bg-stone-950 text-stone-100',
        'font-mono',
        className
      )}
      aria-label="Canvas diagnostic logger"
    >
      <header className="flex items-center gap-1 border-b border-stone-800/80 px-1.5 py-1">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="diagnostic-logger-body"
        >
          <span className="truncate font-sans text-[8px] font-semibold uppercase tracking-wide text-stone-400">
            {sectionLabel} · Truth
          </span>
          {expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-stone-500" aria-hidden />
          ) : (
            <ChevronUp className="h-3 w-3 shrink-0 text-stone-500" aria-hidden />
          )}
        </button>
        <button
          type="button"
          className="shrink-0 rounded bg-emerald-700 px-1.5 py-0.5 font-sans text-[8px] font-semibold leading-none text-white hover:bg-emerald-600"
          onClick={() => void copyState()}
          title="Copy full canvas state JSON to clipboard"
        >
          {copied ? 'Copied' : 'Copy Logs'}
        </button>
      </header>

      <div
        id="diagnostic-logger-body"
        className={cn(
          'px-1.5 py-0.5 font-sans text-[8px] leading-[1.15] tabular-nums',
          !expanded && 'sr-only'
        )}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-stone-400">
          <span data-testid="diagnostic-room-count">
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
            API:{placesLabel}
          </span>
          <span className="text-stone-600">{logs.length}L</span>
        </div>
      </div>

      {expanded ? (
        <div
          className="max-h-[3rem] min-h-[1.25rem] overflow-y-auto overflow-x-hidden border-t border-stone-800/60 px-1.5 py-0.5"
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          <pre className="whitespace-pre-wrap break-all text-[8px] leading-[1.2] text-stone-400">
            {recentLogText || 'Waiting for geometry events…'}
          </pre>
        </div>
      ) : null}
    </section>
  )
}
