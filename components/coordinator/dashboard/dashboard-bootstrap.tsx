'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { useCommandCenterFullscreen } from './command-center-fullscreen-context'
import { DashboardAppShell } from './dashboard-app-shell'
import { DashboardCurationColumn } from './dashboard-curation-column'
import { DashboardCanvasColumn } from './dashboard-canvas-column'

export interface DashboardBootstrapProps {
  header: ReactNode
}

export function DashboardBootstrap({ header }: DashboardBootstrapProps) {
  const { fullscreen: immersive } = useCommandCenterFullscreen()
  const reducedMotion = useReducedMotion()
  const [ariaBusy, setAriaBusy] = useState(true)
  const [liveMessage, setLiveMessage] = useState('Booth layout designer loading.')

  const handleCanvasInteractive = useCallback(() => {
    setAriaBusy(false)
    setLiveMessage('Booth designer canvas is ready.')
  }, [])

  const showBlueprint = false
  const hydrateSidebars = true
  const animateSidebars = !reducedMotion

  return (
    <>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>
      <DashboardAppShell
        header={header}
        immersive={immersive}
        ariaBusy={ariaBusy}
        left={
          <DashboardCurationColumn ready={hydrateSidebars} animate={animateSidebars} />
        }
        center={
          <DashboardCanvasColumn
            showBlueprint={showBlueprint}
            mountCanvas
            reducedMotion={reducedMotion}
            onCanvasInteractive={handleCanvasInteractive}
          />
        }
      />
    </>
  )
}
