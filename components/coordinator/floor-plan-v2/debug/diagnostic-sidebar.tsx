'use client'

import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  vertexCountForMergedZone,
  vertexCountForRoom,
} from '../state/geometry-sanitize'
import type { FloorPlanDoc, MergedZoneObject } from '../state/types'

export interface DiagnosticSidebarProps {
  doc: FloorPlanDoc
  onClearAndReset: () => void
  className?: string
}

function formatVertexAudit(doc: FloorPlanDoc): string {
  const lines: string[] = ['--- Vertex audit ---']
  for (const frame of doc.rooms ?? []) {
    const count = vertexCountForRoom(frame)
    const flag = count > 4 ? ' MALFORMED' : ''
    lines.push(
      `room ${frame.name} (${frame.id.slice(0, 8)}…): ${count} vertices${flag}`
    )
  }
  for (const o of doc.objects) {
    if (o.kind !== 'merged_zone') continue
    const mz = o as MergedZoneObject
    const count = vertexCountForMergedZone(mz)
    const flag = count > 4 ? ' MALFORMED' : ''
    lines.push(`merged_zone ${mz.id.slice(0, 12)}…: ${count} vertices${flag}`)
  }
  lines.push('', '--- doc.rooms JSON ---')
  lines.push(JSON.stringify(doc.rooms ?? [], null, 2))
  return lines.join('\n')
}

/**
 * Fixed right-hand geometry truth panel — vertex audit + live `doc.rooms` JSON.
 */
export function DiagnosticSidebar({
  doc,
  onClearAndReset,
  className,
}: DiagnosticSidebarProps) {
  const [copied, setCopied] = useState(false)
  const auditText = useMemo(() => formatVertexAudit(doc), [doc])

  const malformedIds = useMemo(() => {
    const ids = new Set<string>()
    for (const frame of doc.rooms ?? []) {
      if (vertexCountForRoom(frame) > 4) ids.add(`room:${frame.id}`)
    }
    for (const o of doc.objects) {
      if (o.kind !== 'merged_zone') continue
      if (vertexCountForMergedZone(o as MergedZoneObject) > 4) {
        ids.add(`mz:${o.id}`)
      }
    }
    return ids
  }, [doc])

  const copyRooms = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(auditText)
      setCopied(true)
      toast.success('Diagnostic log copied.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Copy failed — select the textarea and copy manually.')
    }
  }, [auditText])

  const highlightedLines = useMemo(() => {
    return auditText.split('\n').map((line, i) => {
      const malformed = line.includes('MALFORMED')
      return (
        <span
          key={`${i}-${line.slice(0, 12)}`}
          className={cn('block', malformed && 'text-red-400 font-semibold')}
        >
          {line || '\u00a0'}
        </span>
      )
    })
  }, [auditText])

  return (
    <aside
      className={cn(
        'diagnostic-sidebar fixed inset-y-0 right-0 z-[9999] flex w-[300px] flex-col',
        'border-l border-stone-700 bg-stone-950 text-stone-100 shadow-2xl',
        'pointer-events-auto font-mono',
        className
      )}
      aria-label="Canvas diagnostic sidebar"
      data-testid="diagnostic-sidebar"
      data-malformed-count={malformedIds.size}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-stone-800 px-3 py-2">
        <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-stone-400">
          Geometry engine
        </span>
        <span className="text-[10px] text-stone-500">
          {(doc.rooms ?? []).length} room{(doc.rooms ?? []).length === 1 ? '' : 's'}
          {malformedIds.size > 0 ? (
            <span className="ml-1 text-red-400">· {malformedIds.size} bad</span>
          ) : null}
        </span>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 text-[10px] leading-relaxed"
        role="log"
        aria-live="polite"
      >
        {highlightedLines}
      </div>

      <label className="sr-only" htmlFor="diagnostic-rooms-json">
        doc.rooms JSON
      </label>
      <textarea
        id="diagnostic-rooms-json"
        readOnly
        value={JSON.stringify(doc.rooms ?? [], null, 2)}
        className="max-h-[28%] min-h-[4rem] shrink-0 resize-none border-0 border-t border-stone-800 bg-stone-950 px-3 py-2 text-[9px] leading-relaxed text-emerald-100/80 outline-none focus:ring-1 focus:ring-emerald-700/50"
        spellCheck={false}
        aria-label="doc.rooms JSON snapshot"
      />

      <footer className="flex shrink-0 flex-col gap-2 border-t border-stone-800 p-3">
        <button
          type="button"
          className="w-full rounded bg-emerald-700 px-2 py-1.5 font-sans text-[11px] font-semibold text-white hover:bg-emerald-600"
          onClick={() => void copyRooms()}
        >
          {copied ? 'Copied' : 'Copy diagnostic log'}
        </button>
        <button
          type="button"
          className="w-full rounded border border-amber-600/80 bg-amber-950/60 px-2 py-1.5 font-sans text-[11px] font-semibold text-amber-100 hover:bg-amber-900/80"
          onClick={onClearAndReset}
          data-testid="diagnostic-clear-reset"
        >
          Clear All &amp; Reset
        </button>
        <p className="m-0 font-sans text-[9px] leading-snug text-stone-500">
          Lines in red have more than 4 vertices. Clear All hard-resets the
          canvas. Console: <code className="text-stone-400">[PlacementCheck]</code>
        </p>
      </footer>
    </aside>
  )
}
