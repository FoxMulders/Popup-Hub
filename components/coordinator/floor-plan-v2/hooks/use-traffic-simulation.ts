'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { mergedZoneRingsForRoom } from '../engine/BoothArrangementEngine'
import type { PlacementRing } from '../state/placement-surface'
import type { BoothObject, FloorPlanDoc } from '../state/types'
import {
  runTrafficSimulationAsync,
  type TrafficSimulationResult,
} from '@/src/utils/trafficSimulation'

export interface UseTrafficSimulationOptions {
  /** When false, clears results without running the simulation. */
  enabled?: boolean
  cellFt?: number
  obstacleBufferFt?: number
  patronCount?: number
  visualRadiusFt?: number
  driftProbability?: number
  allowDiagonals?: boolean
  booths?: ReadonlyArray<BoothObject>
  roomBoundary?: ReadonlyArray<PlacementRing>
}

export interface UseTrafficSimulationResult {
  result: TrafficSimulationResult | null
  loading: boolean
  /** Normalized booth exposure scores keyed by booth object id (0–100). */
  boothExposureByObjectId: ReadonlyMap<string, number>
  progress: { completed: number; total: number } | null
}

/**
 * Async traffic simulation hook — batches patron pathfinding off the main
 * thread via idle callbacks so canvas edits stay responsive.
 */
export function useTrafficSimulation(
  doc: FloorPlanDoc,
  roomId: string | null | undefined,
  options: UseTrafficSimulationOptions = {}
): UseTrafficSimulationResult {
  const {
    enabled = true,
    cellFt,
    obstacleBufferFt,
    patronCount,
    visualRadiusFt,
    driftProbability,
    allowDiagonals,
    booths,
    roomBoundary,
  } = options

  const resolvedBoundary = useMemo(
    () =>
      roomBoundary ?? (roomId ? mergedZoneRingsForRoom(doc, roomId) : []),
    [doc, roomId, roomBoundary]
  )

  const [result, setResult] = useState<TrafficSimulationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{
    completed: number
    total: number
  } | null>(null)
  const generationRef = useRef(0)

  useEffect(() => {
    if (!enabled || !roomId) {
      setResult(null)
      setLoading(false)
      setProgress(null)
      return
    }

    const generation = ++generationRef.current
    setLoading(true)
    setProgress(null)

    let cancelled = false

    runTrafficSimulationAsync(
      doc,
      roomId,
      {
        cellFt: cellFt ?? doc.snapFt,
        obstacleBufferFt,
        patronCount,
        visualRadiusFt,
        driftProbability,
        allowDiagonals,
        booths: booths ? [...booths] : undefined,
        roomBoundary: resolvedBoundary,
      },
      (p) => {
        if (!cancelled && generation === generationRef.current) {
          setProgress({ completed: p.completedPatrons, total: p.totalPatrons })
        }
      }
    )
      .then((sim) => {
        if (!cancelled && generation === generationRef.current) {
          setResult(sim)
          setLoading(false)
          setProgress(null)
        }
      })
      .catch(() => {
        if (!cancelled && generation === generationRef.current) {
          setResult(null)
          setLoading(false)
          setProgress(null)
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    doc,
    roomId,
    enabled,
    cellFt,
    obstacleBufferFt,
    patronCount,
    visualRadiusFt,
    driftProbability,
    allowDiagonals,
    booths,
    resolvedBoundary,
  ])

  const boothExposureByObjectId = useMemo(
    () => result?.boothExposureByObjectId ?? new Map<string, number>(),
    [result]
  )

  return { result, loading, boothExposureByObjectId, progress }
}
