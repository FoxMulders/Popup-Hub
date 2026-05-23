'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { runLayoutRegression100Async, type RegressionRunResult } from '@/lib/booth-planner/qa-regression-100'
import {
  runLiveLayoutChecks,
  liveLayoutFingerprint,
  type LiveLayoutQaInput,
  type LiveLayoutQaResult,
} from '@/lib/booth-planner/live-layout-qa'

export interface UseLiveLayoutQaOptions {
  enabled?: boolean
  /** Debounce for synchronous overlap/stroller desk checks. */
  liveDebounceMs?: number
  /** Debounce before kicking off the 100-scenario regression suite. */
  regressionDebounceMs?: number
  runRegression?: boolean
}

export interface UseLiveLayoutQaState {
  live: LiveLayoutQaResult | null
  regression: RegressionRunResult | null
  regressionRunning: boolean
  qaRunning: boolean
}

export function useLiveLayoutQa(
  input: LiveLayoutQaInput,
  options: UseLiveLayoutQaOptions = {}
): UseLiveLayoutQaState {
  const {
    enabled = true,
    liveDebounceMs = 200,
    regressionDebounceMs = 1200,
    runRegression = true,
  } = options
  const [live, setLive] = useState<LiveLayoutQaResult | null>(null)
  const [regression, setRegression] = useState<RegressionRunResult | null>(null)
  const [regressionRunning, setRegressionRunning] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const regressionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef(input)
  inputRef.current = input

  const fingerprint = useMemo(() => liveLayoutFingerprint(input), [
    input.cols,
    input.rows,
    input.cellWidthFt,
    input.cellLengthFt,
    input.cells,
    input.venueElements,
  ])

  useEffect(() => {
    if (!enabled) return

    if (liveTimerRef.current) clearTimeout(liveTimerRef.current)
    liveTimerRef.current = setTimeout(() => {
      setLive(runLiveLayoutChecks(inputRef.current))
    }, liveDebounceMs)

    return () => {
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current)
    }
  }, [enabled, liveDebounceMs, fingerprint])

  useEffect(() => {
    if (!enabled || !runRegression) return

    if (regressionTimerRef.current) clearTimeout(regressionTimerRef.current)
    regressionTimerRef.current = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setRegressionRunning(true)

      void runLayoutRegression100Async(
        42,
        (progress) => {
          setRegression({
            passed: progress.completed - progress.failed.length,
            total: progress.total,
            completed: progress.completed,
            failed: progress.failed,
            logs: progress.logs,
            stopped: progress.stopped,
          })
        },
        { signal: controller.signal }
      )
        .then((out) => {
          if (!controller.signal.aborted) setRegression(out)
        })
        .finally(() => {
          if (abortRef.current === controller) {
            setRegressionRunning(false)
            abortRef.current = null
          }
        })
    }, regressionDebounceMs)

    return () => {
      if (regressionTimerRef.current) clearTimeout(regressionTimerRef.current)
    }
  }, [enabled, regressionDebounceMs, runRegression, fingerprint])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  return {
    live,
    regression,
    regressionRunning,
    qaRunning: regressionRunning,
  }
}
