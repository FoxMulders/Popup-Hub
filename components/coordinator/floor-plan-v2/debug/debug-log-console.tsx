'use client'

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useDebugLog } from './debug-log-context'

export interface DebugLogConsoleProps {
  /** When false, the console is hidden entirely. */
  enabled?: boolean
  className?: string
}

export function DebugLogConsole({
  enabled = true,
  className,
}: DebugLogConsoleProps) {
  const { logs, clearLogs } = useDebugLog()
  const [collapsed, setCollapsed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyLogs = useCallback(async () => {
    const text = logs.length > 0 ? logs.slice().reverse().join('\n') : ''
    if (!text) {
      toast.message('No logs to copy yet.')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Geometry logs copied to clipboard.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy logs — check clipboard permissions.')
    }
  }, [logs])

  if (!enabled) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 right-4 z-[9999] flex w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-stone-600 bg-stone-950/95 font-mono text-[11px] text-emerald-100 shadow-2xl backdrop-blur-sm',
        className
      )}
      role="log"
      aria-label="Canvas geometry debug log"
    >
      <div className="flex items-center gap-2 border-b border-stone-700 bg-stone-900/90 px-2 py-1.5">
        <span className="flex-1 font-sans text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Geometry debug
        </span>
        <button
          type="button"
          className="rounded px-2 py-0.5 font-sans text-[10px] text-stone-300 hover:bg-stone-800"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
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
          className="rounded bg-emerald-800 px-2 py-0.5 font-sans text-[10px] font-semibold text-emerald-50 hover:bg-emerald-700"
          onClick={() => void copyLogs()}
        >
          {copied ? 'Copied' : 'Copy Logs'}
        </button>
      </div>
      {!collapsed ? (
        <div className="max-h-52 overflow-y-auto px-2 py-2 leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-stone-500">
              Waiting for merge, placement, or room updates…
            </p>
          ) : (
            <pre className="whitespace-pre-wrap break-all">
              {logs.slice().reverse().join('\n')}
            </pre>
          )}
        </div>
      ) : null}
    </div>
  )
}
