'use client'

import { useMemo, useState } from 'react'
import { generateFairLayout } from '@/lib/vendor-fairness-layout'
import { computeFairnessScore, heatmapGrid } from '@/lib/vendor-fairness-layout/scoring'
import { simulateExposure } from '@/lib/vendor-fairness-layout/exposure'
import { roomBoundingBox } from '@/lib/vendor-fairness-layout/geometry'
import { FloorPlan } from '@/components/vendor-fairness-layout'

const DEMO_ROOM = {
  boundary: [
    { x: 0, y: 0 },
    { x: 120, y: 0 },
    { x: 120, y: 90 },
    { x: 0, y: 90 },
  ],
}

function makeBooths(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `booth_${String(i + 1).padStart(3, '0')}`,
    width: 10,
    height: 8,
  }))
}

export function FairnessLayoutDemo() {
  const [boothCount, setBoothCount] = useState(20)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReturnType<typeof generateFairLayout> | null>(null)

  const booths = useMemo(() => makeBooths(boothCount), [boothCount])

  function runLayout() {
    setLoading(true)
    requestAnimationFrame(() => {
      const start = performance.now()
      const layout = generateFairLayout(
        {
          room: DEMO_ROOM,
          booths,
          entrance: { x: 10, y: 85 },
          exit: { x: 110, y: 5 },
        },
        { timeBudgetMs: boothCount > 100 ? 2000 : 1200 }
      )
      const elapsed = performance.now() - start
      console.info(`Fair layout generated in ${elapsed.toFixed(0)}ms, score=${layout.fairnessScore}`)
      setResult(layout)
      setLoading(false)
    })
  }

  const heatmap = useMemo(() => {
    if (!result) return []
    const bbox = roomBoundingBox(DEMO_ROOM.boundary)
    const exposure = simulateExposure({
      booths: result.placements.map((p) => ({
        id: p.boothId,
        x: p.x,
        y: p.y,
        width: 10,
        height: 8,
        rotation: p.rotation,
      })),
      route: result.route,
      entrance: { x: 10, y: 85 },
      exit: { x: 110, y: 5 },
    })
    const fairness = computeFairnessScore(
      exposure,
      result.placements.map((p) => ({
        id: p.boothId,
        x: p.x,
        y: p.y,
        width: 10,
        height: 8,
        rotation: p.rotation,
      }))
    )
    return heatmapGrid(fairness.heatmap, 5, {
      minX: bbox.x,
      minY: bbox.y,
      maxX: bbox.x + bbox.width,
      maxY: bbox.y + bbox.height,
    })
  }, [result])

  const boothSizes = useMemo(
    () => new Map(booths.map((b) => [b.id, { width: b.width, height: b.height }])),
    [booths]
  )

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Vendor Fairness Layout Engine</h1>
      <p className="text-muted-foreground text-sm">
        Fairness-first booth placement — minimizes exposure variance across vendors.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          Booths:{' '}
          <input
            type="range"
            min={5}
            max={200}
            value={boothCount}
            onChange={(e) => setBoothCount(Number(e.target.value))}
          />
          {boothCount}
        </label>
        <button
          type="button"
          onClick={runLayout}
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate fair layout'}
        </button>
        {result && (
          <span className="text-sm font-medium">Fairness score: {result.fairnessScore}/100</span>
        )}
      </div>
      {result && (
        <FloorPlan
          boundary={DEMO_ROOM.boundary}
          placements={result.placements}
          boothSizes={boothSizes}
          route={result.route}
          heatmap={heatmap}
          fairnessScore={result.fairnessScore}
          width={900}
          height={650}
          className="rounded-lg border bg-white shadow-sm"
        />
      )}
    </div>
  )
}
