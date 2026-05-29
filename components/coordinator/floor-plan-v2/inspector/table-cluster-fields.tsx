'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import type { BoothObject } from '../state/types'
import {
  TABLE_CLUSTER_PRESET_IDS,
  applyTableClusterPreset,
  boothHasTableCluster,
  inferClusterPreset,
  patchBoothSubTableRotation,
  type TableClusterPresetId,
} from '../state/table-cluster-layout'
import {
  clusterBodyClass,
  clusterHeadingClass,
  clusterHintClass,
  clusterPanelClass,
  inspectorControlClassName,
  inspectorFieldsetClass,
  inspectorFocusRingClass,
  inspectorLabelClass,
  inspectorLegendClass,
  inspectorToggleClassName,
} from './inspector-field-styles'

const PRESET_LABELS: Record<TableClusterPresetId, string> = {
  '2x5': '2×5′',
  '2x6': '2×6′',
  '3x5': '3×5′',
  '3x6': '3×6′',
}

const SUB_ROTATION_PRESETS = [
  { deg: 0, label: '0°' },
  { deg: 45, label: '45°' },
  { deg: 90, label: '90°' },
  { deg: -45, label: '−45°' },
] as const

interface TableClusterFieldsProps {
  store: FloorPlanDocStore
  booth: BoothObject
}

export function TableClusterFields({ store, booth }: TableClusterFieldsProps) {
  const headingId = useId()
  const descId = useId()
  const presetFieldId = useId()
  const subTableFieldId = useId()
  const rotationGroupId = useId()
  const angleFieldId = useId()

  const cluster = booth.tableCluster
  const inferred = inferClusterPreset(
    booth.tableCount ?? 1,
    booth.tableLengthFt ?? 5
  )
  const [selectedSubId, setSelectedSubId] = useState(
    cluster?.subTables[0]?.id ?? 't0'
  )

  const activePreset = cluster?.presetId ?? inferred
  const hasCluster = boothHasTableCluster(booth)
  const selectedSub = hasCluster
    ? booth.tableCluster.subTables.find((s) => s.id === selectedSubId)
    : undefined
  const selectedSubIndex = hasCluster
    ? booth.tableCluster.subTables.findIndex((s) => s.id === selectedSubId)
    : -1
  const selectedSubLabel =
    selectedSubIndex >= 0 ? `Table ${selectedSubIndex + 1}` : 'selected table'

  function applyPreset(presetId: TableClusterPresetId) {
    const next = applyTableClusterPreset(booth, presetId)
    store.updateObject(booth.id, {
      tableCluster: next.tableCluster,
      tableCount: next.tableCount,
      tableLengthFt: next.tableLengthFt,
      x: next.x,
      y: next.y,
      width: next.width,
      height: next.height,
    })
  }

  function applySubRotation(deg: number) {
    if (!cluster) return
    const next = patchBoothSubTableRotation(booth, selectedSubId, deg)
    store.updateObject(booth.id, {
      tableCluster: next.tableCluster,
      x: next.x,
      y: next.y,
      width: next.width,
      height: next.height,
    })
  }

  return (
    <section
      className={clusterPanelClass}
      aria-labelledby={headingId}
      aria-describedby={descId}
    >
      <header className="flex flex-col gap-1">
        <h4 id={headingId} className={clusterHeadingClass}>
          Table cluster
        </h4>
        <p id={descId} className={clusterBodyClass}>
          One vendor unit — drag and join move the whole group. Angle individual
          tables for corners or conversational layouts.
        </p>
      </header>

      <fieldset className={inspectorFieldsetClass}>
        <legend className={inspectorLegendClass}>Preset</legend>
        <label htmlFor={presetFieldId} className="sr-only">
          Table cluster preset
        </label>
        <select
          id={presetFieldId}
          className={inspectorControlClassName('border-sky-200')}
          value={activePreset ?? ''}
          onChange={(e) => {
            const v = e.target.value as TableClusterPresetId
            if (v) applyPreset(v)
          }}
        >
          <option value="" disabled>
            Choose preset…
          </option>
          {TABLE_CLUSTER_PRESET_IDS.map((id) => (
            <option key={id} value={id}>
              {PRESET_LABELS[id]}
            </option>
          ))}
        </select>
      </fieldset>

      {hasCluster ? (
        <fieldset className={cn(inspectorFieldsetClass, 'flex flex-col gap-3')}>
          <legend className={inspectorLegendClass}>Sub-table layout</legend>

          <div className="grid grid-cols-1 gap-3 @min-[14rem]:grid-cols-[minmax(0,1fr)_auto] @min-[14rem]:items-end">
            <div className="flex min-w-0 flex-col gap-1">
              <label htmlFor={subTableFieldId} className={inspectorLabelClass}>
                Sub-table
              </label>
              <select
                id={subTableFieldId}
                className={inspectorControlClassName('border-sky-200')}
                value={selectedSubId}
                onChange={(e) => setSelectedSubId(e.target.value)}
                aria-controls={rotationGroupId}
              >
                {booth.tableCluster.subTables.map((sub, idx) => (
                  <option key={sub.id} value={sub.id}>
                    Table {idx + 1} ({sub.tableLengthFt}′)
                  </option>
                ))}
              </select>
            </div>

            <div
              id={rotationGroupId}
              role="group"
              aria-label={`Rotation presets for ${selectedSubLabel}`}
              className="flex flex-wrap gap-1"
            >
              {SUB_ROTATION_PRESETS.map(({ deg, label }) => {
                const active = selectedSub?.rotationOffsetDeg === deg
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${label} rotation for ${selectedSubLabel}`}
                    onClick={() => applySubRotation(deg)}
                    className={inspectorToggleClassName(active)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <ClusterNumberField
            id={angleFieldId}
            label="Sub-table angle (°)"
            value={selectedSub?.rotationOffsetDeg ?? 0}
            min={-180}
            max={180}
            step={5}
            aria-describedby={descId}
            onChange={(v) => applySubRotation(v)}
          />

          <p className={clusterHintClass}>
            Compound footprint (W×H): {booth.width.toFixed(1)}′ ×{' '}
            {booth.height.toFixed(1)}′ — updates when sub-tables are angled.
          </p>
        </fieldset>
      ) : inferred ? (
        <p>
          <button
            type="button"
            onClick={() => applyPreset(inferred)}
            className={cn(
              'w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-xs font-semibold text-sky-800 transition-colors duration-150 hover:bg-sky-100',
              inspectorFocusRingClass
            )}
          >
            Convert to {PRESET_LABELS[inferred]} cluster
          </button>
        </p>
      ) : null}
    </section>
  )
}

function ClusterNumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  'aria-describedby': ariaDescribedBy,
}: {
  id: string
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  'aria-describedby'?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={inspectorLabelClass}>
        {label}
      </label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        aria-describedby={ariaDescribedBy}
        onChange={(e) => {
          const next = parseFloat(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className={inspectorControlClassName('border-sky-200')}
      />
    </div>
  )
}
