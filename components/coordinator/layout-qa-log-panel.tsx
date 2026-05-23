'use client'

import { useState, useCallback, useRef } from 'react'
import { FlaskConical, Play, ChevronDown, ChevronUp, XCircle } from 'lucide-react'
import { runLayoutRegression100Async, type RegressionRunResult } from '@/lib/booth-planner/qa-regression-100'
import type { LiveLayoutQaResult } from '@/lib/booth-planner/live-layout-qa'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface LayoutQaLogPanelProps {
  live?: LiveLayoutQaResult | null
  liveRegression?: RegressionRunResult | null
  liveRegressionRunning?: boolean
}

export function LayoutQaLogPanel({
  live = null,
  liveRegression = null,
  liveRegressionRunning = false,
}: LayoutQaLogPanelProps) {
  const [result, setResult] = useState<RegressionRunResult | null>(null)
  const [manualRunning, setManualRunning] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const isQaCancelledRef = useRef(false)

  const handleStop = useCallback(() => {
    isQaCancelledRef.current = true
    abortRef.current?.abort()
    setManualRunning(false)
  }, [])

  const handleRun = useCallback(async () => {
    abortRef.current?.abort()
    isQaCancelledRef.current = false
    const controller = new AbortController()
    abortRef.current = controller

    setManualRunning(true)
    setResult(null)
    try {
      const out = await runLayoutRegression100Async(
        42,
        (progress) => {
          if (isQaCancelledRef.current) return
          setResult({
            passed: progress.completed - progress.failed.length,
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed,
            logs: progress.logs,
            stopped: progress.stopped,
          })
        },
        {
          signal: controller.signal,
          isCancelled: () => isQaCancelledRef.current,
        }
      )
      if (!isQaCancelledRef.current) {
        setResult(out)
      }
    } finally {
      setManualRunning(false)
      if (abortRef.current === controller) {
        abortRef.current = null
      }
    }
  }, [])

  const passed = result?.passed ?? liveRegression?.passed ?? 0
  const total = result?.total ?? liveRegression?.total ?? 100
  const completed = result?.completed ?? liveRegression?.completed ?? 0
  const stopped = result?.stopped === true
  const allPassed =
    (result != null && !stopped && result.failed.length === 0 && completed >= total) ||
    (liveRegression != null &&
      !liveRegression.stopped &&
      liveRegression.failed.length === 0 &&
      liveRegression.completed >= liveRegression.total)
  const qaRunning = manualRunning || liveRegressionRunning
  const failedList = result?.failed ?? liveRegression?.failed ?? []

  return (
    <article
      className="market-panel p-4 space-y-3"
      aria-label="Layout engine regression tests"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-forest" aria-hidden />
          <h3 className="text-sm font-heading font-semibold text-foreground">Layout QA</h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-11 gap-1.5"
          disabled={qaRunning}
          onClick={handleRun}
        >
          <Play className="h-3.5 w-3.5" />
          Run 100
        </Button>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Status</dt>
        <dd className="font-medium tabular-nums">
          {qaRunning ? (
            <span className="inline-flex flex-wrap items-center gap-2 text-harvest-800">
              <span className="animate-pulse">Running…</span>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="min-h-9 h-9 gap-1.5 px-2.5 text-xs font-semibold"
                onClick={handleStop}
              >
                <XCircle className="h-3.5 w-3.5" />
                Stop QA
              </Button>
            </span>
          ) : stopped ? (
            <span className="text-terracotta-800">Stopped at {completed}/{total}</span>
          ) : result ? (
            <span className={allPassed ? 'text-sage-800' : 'text-terracotta-800'}>
              Passed {passed}/{total}
            </span>
          ) : (
            <span className="text-muted-foreground">Not run</span>
          )}
        </dd>
        {(qaRunning || stopped || (result && completed > 0) || liveRegression) ? (
          <>
            <dt className="text-muted-foreground">Progress</dt>
            <dd className="font-medium tabular-nums">{completed}/{total}</dd>
          </>
        ) : null}
      </dl>

      {stopped ? (
        <p className="text-xs text-terracotta-900 bg-terracotta-50 border border-terracotta-200 rounded-lg px-2 py-1.5">
          QA run halted manually — {completed} of {total} scenarios executed ({passed} passed before stop).
        </p>
      ) : null}

      {live ? (
        <div className="rounded-none border-2 border-black bg-white p-2 text-[10px] font-bold text-black space-y-1">
          <p className="uppercase tracking-wide">Live QA desk</p>
          <p>
            Overlap: {live.hasOverlap ? `${live.overlapCellCount} cells` : 'clear'} · Stroller:{' '}
            {live.hasStrollerBottleneck ? `${live.strollerBottleneckCount} bottlenecks` : 'safe'} ·
            Placement: {live.placementValid ? 'valid' : 'invalid'}
          </p>
          <p className="text-[9px] font-semibold text-zinc-700 tabular-nums">
            Synced {new Date(live.checkedAt).toLocaleTimeString()}
          </p>
        </div>
      ) : null}

      {failedList.length > 0 ? (
        <div className="rounded-lg border-2 border-terracotta-200 bg-terracotta-50/80 p-3 text-xs">
          <button
            type="button"
            className="flex w-full items-center justify-between font-semibold text-terracotta-900 min-h-11"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {failedList.length} failure{failedList.length === 1 ? '' : 's'} — coordinate telemetry
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {expanded ? (
            <ul className="mt-2 max-h-48 overflow-y-auto space-y-1 font-mono text-[10px] text-terracotta-950">
              {(result?.logs ?? liveRegression?.logs ?? []).filter((l) => l.level === 'error').map((log, i) => (
                <li key={i} className="border-b border-terracotta-200/60 pb-1">
                  {log.message}
                  {log.telemetry ? (
                    <span className="block text-terracotta-800/90 mt-0.5">
                      {JSON.stringify(log.telemetry)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (result || liveRegression) && allPassed ? (
        <p className="text-xs text-sage-800 bg-sage-50 border border-sage-200 rounded-lg px-2 py-1.5">
          All 100 scenarios passed — bitmask overlap and FCFS co-aisle placement verified.
        </p>
      ) : null}

      <p className={cn('text-[10px] font-semibold text-black', qaRunning && 'animate-pulse')}>
        Uint8Array bitmask · quadtree category isolation · CI: npm run qa:regression
      </p>
    </article>
  )
}
