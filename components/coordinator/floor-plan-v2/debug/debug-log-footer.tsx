'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { useDebugLog } from './debug-log-context'
import { formatDebugLogText } from './format-debug-log-text'

export interface DebugLogFooterProps {
  enabled?: boolean
  className?: string
}

/**
 * Workspace footer strip — copy/paste friendly troubleshooting log.
 */
export function DebugLogFooter({
  enabled = true,
  className,
}: DebugLogFooterProps) {
  const { logs, clearLogs } = useDebugLog()
  const [expanded, setExpanded] = useState(true)
  const [copied, setCopied] = useState(false)

  const logText = useMemo(() => formatDebugLogText(logs), [logs])

  const copyLogs = useCallback(async () => {
    if (!logText) {
      toast.message('No log lines yet — interact with the canvas to capture events.')
      return
    }
    try {
      await navigator.clipboard.writeText(logText)
      setCopied(true)
      toast.success('Troubleshooting log copied to clipboard.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy — select the log text and copy manually (Ctrl+C).')
    }
  }, [logText])

  if (!enabled) return null

  return (
    <footer
      className={cn(
        'shrink-0 border-t border-stone-300 bg-stone-900 text-stone-100',
        className
      )}
      aria-label="Canvas troubleshooting log"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-stone-700 px-2 py-1.5 sm:px-3">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Troubleshooting log
        </span>
        <span className="font-mono text-[10px] text-stone-500">
          {logs.length} line{logs.length === 1 ? '' : 's'}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded px-2 py-0.5 font-sans text-[10px] text-stone-300 hover:bg-stone-800"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Shrink' : 'Expand'}
          </button>
          <button
            type="button"
            className="rounded px-2 py-0.5 font-sans text-[10px] text-stone-300 hover:bg-stone-800"
            onClick={clearLogs}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded bg-emerald-700 px-3 py-0.5 font-sans text-[10px] font-semibold text-white hover:bg-emerald-600"
            onClick={() => void copyLogs()}
          >
            {copied ? 'Copied' : 'Copy log'}
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="px-2 py-2 sm:px-3">
          <textarea
            readOnly
            value={logText}
            placeholder="Geometry events and errors appear here (oldest first)…"
            aria-label="Troubleshooting log text"
            className={cn(
              'w-full resize-y rounded border border-stone-700 bg-stone-950 px-2 py-1.5',
              'font-mono text-[10px] leading-relaxed text-emerald-100',
              'focus:outline-none focus:ring-1 focus:ring-emerald-600',
              expanded ? 'min-h-[72px] max-h-40' : 'h-0'
            )}
            rows={5}
            onFocus={(e) => e.currentTarget.select()}
          />
          <p className="mt-1 font-sans text-[10px] text-stone-500">
            Click the field to select all, or use Copy log — paste into support chat or a
            ticket.
          </p>
        </div>
      ) : null}
    </footer>
  )
}
