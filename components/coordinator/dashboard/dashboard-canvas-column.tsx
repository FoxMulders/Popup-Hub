'use client'

import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BlueprintLoader } from './blueprint-loader'
import { CanvasZoneSkeleton } from './dashboard-zone-skeletons'

const DashboardFloorPlanViewport = lazy(() =>
  import('./dashboard-floor-plan').then((m) => ({ default: m.DashboardFloorPlanViewport }))
)

export interface DashboardCanvasColumnProps {
  showBlueprint: boolean
  mountCanvas: boolean
  reducedMotion: boolean
  onCanvasInteractive: () => void
}

export function DashboardCanvasColumn({
  showBlueprint,
  mountCanvas,
  reducedMotion,
  onCanvasInteractive,
}: DashboardCanvasColumnProps) {
  const [reportedInteractive, setReportedInteractive] = useState(false)

  const handleInteractive = useCallback(() => {
    if (reportedInteractive) return
    setReportedInteractive(true)
    onCanvasInteractive()
  }, [onCanvasInteractive, reportedInteractive])

  useEffect(() => {
    if (!mountCanvas || reducedMotion) return
    const fallback = window.setTimeout(handleInteractive, 2400)
    return () => window.clearTimeout(fallback)
  }, [mountCanvas, reducedMotion, handleInteractive])

  return (
    <div className="relative h-full min-h-0 w-full">
      <AnimatePresence mode="wait">
        {showBlueprint ? (
          <motion.div
            key="blueprint"
            className="absolute inset-0 flex items-center justify-center bg-canvas/50 p-4"
            initial={reducedMotion ? false : { opacity: 1 }}
            exit={
              reducedMotion
                ? { opacity: 0, transition: { duration: 0.12 } }
                : { opacity: 0, scale: 0.995, transition: { duration: 0.35, ease: 'easeOut' } }
            }
          >
            <BlueprintLoader instant={reducedMotion} className="max-h-[min(72vh,520px)]" />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {mountCanvas ? (
        <Suspense fallback={<CanvasZoneSkeleton />}>
          <motion.div
            className="absolute inset-0 flex min-h-0 flex-col"
            initial={reducedMotion ? false : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={
              reducedMotion
                ? { duration: 0.01 }
                : { type: 'spring', stiffness: 340, damping: 32, mass: 0.85 }
            }
            onAnimationComplete={() => {
              if (!reducedMotion) handleInteractive()
            }}
          >
            <DashboardFloorPlanViewport onInteractive={handleInteractive} />
          </motion.div>
        </Suspense>
      ) : (
        <CanvasZoneSkeleton />
      )}
    </div>
  )
}
