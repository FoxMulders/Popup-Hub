'use client'

import { Suspense, lazy } from 'react'
import { motion, type Variants } from 'framer-motion'
import { CurationZoneSkeleton } from './dashboard-zone-skeletons'

const CurationQueueColumn = lazy(() =>
  import('./curation-queue-column').then((m) => ({ default: m.CurationQueueColumn }))
)

const sidebarStagger: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 420, damping: 34, staggerChildren: 0.1 },
  },
}

export interface DashboardCurationColumnProps {
  ready: boolean
  animate: boolean
}

export function DashboardCurationColumn({ ready, animate }: DashboardCurationColumnProps) {
  if (!ready) {
    return <CurationZoneSkeleton />
  }

  const content = (
    <Suspense fallback={<CurationZoneSkeleton />}>
      <CurationQueueColumn />
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
