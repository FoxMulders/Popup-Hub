'use client'

import { Suspense, lazy } from 'react'
import { motion, type Variants } from 'framer-motion'
import { TelemetryZoneSkeleton } from './dashboard-zone-skeletons'

const TelemetryDeskColumn = lazy(() =>
  import('./telemetry-desk-column').then((m) => ({ default: m.TelemetryDeskColumn }))
)

const sidebarStagger: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 420, damping: 34, staggerChildren: 0.1 },
  },
}

export interface DashboardTelemetryColumnProps {
  ready: boolean
  animate: boolean
}

export function DashboardTelemetryColumn({ ready, animate }: DashboardTelemetryColumnProps) {
  if (!ready) {
    return <TelemetryZoneSkeleton />
  }

  const content = (
    <Suspense fallback={<TelemetryZoneSkeleton />}>
      <TelemetryDeskColumn />
    </Suspense>
  )

  if (!animate) {
    return content
  }

  return (
    <motion.div
      className="flex h-full min-h-0 flex-col"
      variants={sidebarStagger}
      initial="hidden"
      animate="visible"
    >
      {content}
    </motion.div>
  )
}
