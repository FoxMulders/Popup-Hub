'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { DashboardAppShell } from './dashboard-app-shell'
import { DashboardCurationColumn } from './dashboard-curation-column'
import { DashboardCanvasColumn } from './dashboard-canvas-column'
import { DashboardTelemetryColumn } from './dashboard-telemetry-column'

type BootstrapPhase = 'shell' | 'blueprint' | 'hydrating' | 'ready'

const HYDRATE_MS = 900
const READY_MS = 1400

function scheduleIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 480 })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(callback, 32)
  return () => window.clearTimeout(id)
}

export interface DashboardBootstrapProps {
  header: ReactNode
}

export function DashboardBootstrap({ header }: DashboardBootstrapProps) {
  const reducedMotion = useReducedMotion()
  const [phase, setPhase] = useState<BootstrapPhase>(() =>
    reducedMotion ? 'ready' : 'shell'
  )
  const [mountCanvas, setMountCanvas] = useState(reducedMotion)
  const [ariaBusy, setAriaBusy] = useState(true)
  const [liveMessage, setLiveMessage] = useState('')
  const timersRef = useRef<number[]>([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => {
    if (reducedMotion) {
      clearTimers()
      setPhase('ready')
      setMountCanvas(true)
      setAriaBusy(false)
      setLiveMessage('Market command center ready.')
      return
    }

    clearTimers()
    setPhase('shell')

    const queue = (fn: () => void, ms: number) => {
      const id = window.setTimeout(fn, ms)
      timersRef.current.push(id)
    }

    queue(() => setPhase('blueprint'), 0)
    queue(() => setPhase('hydrating'), HYDRATE_MS)
    queue(() => {
      setPhase('ready')
      setLiveMessage('Market command center ready. Booth designer is interactive.')
    }, READY_MS)

    return clearTimers
  }, [reducedMotion, clearTimers])

  useEffect(() => {
    if (phase !== 'ready' && !reducedMotion) return
    let cancelled = false
    const cancelIdle = scheduleIdle(() => {
      if (!cancelled) setMountCanvas(true)
    })
    return () => {
      cancelled = true
      cancelIdle()
    }
  }, [phase, reducedMotion])

  const handleCanvasInteractive = useCallback(() => {
    setAriaBusy(false)
    setLiveMessage('Booth designer canvas is ready.')
  }, [])

  const showBlueprint = !reducedMotion && (phase === 'shell' || phase === 'blueprint')
  const hydrateSidebars = phase === 'hydrating' || phase === 'ready' || reducedMotion
  const animateSidebars = !reducedMotion && phase !== 'shell'

  return (
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>
      <DashboardAppShell
        header={header}
        ariaBusy={ariaBusy}
        left={
          <DashboardCurationColumn ready={hydrateSidebars} animate={animateSidebars} />
        }
        center={
          <DashboardCanvasColumn
            showBlueprint={showBlueprint}
            mountCanvas={mountCanvas}
            reducedMotion={reducedMotion}
            onCanvasInteractive={handleCanvasInteractive}
          />
        }
        right={
          <DashboardTelemetryColumn ready={hydrateSidebars} animate={animateSidebars} />
        }
      />
    </>
  )
}
