'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CouncilTelemetryPanel } from '@/components/experience-designer/inspector/council-telemetry-panel'
import { ZoneInspectorPanel } from '@/components/experience-designer/inspector/zone-inspector-panel'
import { findZoneById } from '@/lib/experience-designer/room-skeleton-flow'
import type { WorkspaceInspectorProps } from '@/components/experience-designer/wizard/wizard-left-panel-types'

export function WorkspaceInspector({
  selectedZoneId,
  roomSkeleton,
  telemetry,
  constraints,
  onClearSelection,
}: WorkspaceInspectorProps) {
  const selectedZone = findZoneById(roomSkeleton, selectedZoneId)

  return (
    <div className="relative h-full overflow-hidden">
      <AnimatePresence mode="wait" initial={false}>
        {selectedZone ? (
          <motion.div
            key={`zone-${selectedZone.id}`}
            initial={{ x: 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="absolute inset-0"
          >
            <ZoneInspectorPanel zone={selectedZone} onBack={onClearSelection} />
          </motion.div>
        ) : (
          <motion.div
            key="telemetry"
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className="absolute inset-0"
          >
            <CouncilTelemetryPanel telemetry={telemetry} constraints={constraints} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
