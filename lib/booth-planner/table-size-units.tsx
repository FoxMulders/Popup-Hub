'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type TableSizeUnits = 'imperial' | 'metric'

const STORAGE_KEY = 'popup-hub:table-size-units'
const TABLE_SIZE_UNITS_CHANGED = 'popup-hub:table-size-units-changed'

function formatMetricMeters(ft: number): string {
  const meters = ft * 0.3048
  return `${meters % 1 === 0 ? meters.toFixed(0) : meters.toFixed(1)} m`
}

function formatImperialFeet(ft: number, roundWhole = false): string {
  if (roundWhole) return `${Math.round(ft)}′`
  const rounded = Math.round(ft * 10) / 10
  return `${Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)}′`
}

export function formatTableSizeDisplay(ft: number, units: TableSizeUnits): string {
  if (units === 'metric') return formatMetricMeters(ft)
  return `${ft}′`
}

/** Single dimension label (supports fractional feet). */
export function formatDimensionDisplay(ft: number, units: TableSizeUnits): string {
  if (units === 'metric') return formatMetricMeters(ft)
  return formatImperialFeet(ft)
}

/** Width × length footprint label. */
export function formatFootprintDisplay(
  widthFt: number,
  lengthFt: number,
  units: TableSizeUnits
): string {
  if (units === 'metric') {
    const formatM = (ft: number) => {
      const m = ft * 0.3048
      return m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)
    }
    return `${formatM(widthFt)} m × ${formatM(lengthFt)} m`
  }
  return `${formatImperialFeet(widthFt, true)} × ${formatImperialFeet(lengthFt, true)}`
}

function emitTableSizeUnitsChanged(units: TableSizeUnits) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent<TableSizeUnits>(TABLE_SIZE_UNITS_CHANGED, { detail: units })
  )
}

export function useTableSizeUnits(): [TableSizeUnits, (units: TableSizeUnits) => void] {
  const [units, setUnitsState] = useState<TableSizeUnits>('imperial')

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw === 'metric' || raw === 'imperial') setUnitsState(raw)
    } catch {
      // ignore
    }

    const onUnitsChanged = (event: Event) => {
      const next = (event as CustomEvent<TableSizeUnits>).detail
      if (next === 'metric' || next === 'imperial') setUnitsState(next)
    }
    window.addEventListener(TABLE_SIZE_UNITS_CHANGED, onUnitsChanged)
    return () => window.removeEventListener(TABLE_SIZE_UNITS_CHANGED, onUnitsChanged)
  }, [])

  const setUnits = useCallback((next: TableSizeUnits) => {
    setUnitsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
    emitTableSizeUnitsChanged(next)
  }, [])

  return [units, setUnits]
}

export function TableSizeUnitsToggle({
  units,
  onChange,
  compact,
  className,
}: {
  units: TableSizeUnits
  onChange: (units: TableSizeUnits) => void
  compact?: boolean
  className?: string
}) {
  const btnClass = (active: boolean) =>
    cn(
      'font-semibold transition-colors',
      compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
      active ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
    )

  return (
    <div
      className={cn(
        'inline-flex overflow-hidden rounded-md border border-stone-200',
        className
      )}
      role="group"
      aria-label="Table size units"
    >
      <button
        type="button"
        aria-pressed={units === 'imperial'}
        title="Show feet and inches"
        onClick={() => onChange('imperial')}
        className={btnClass(units === 'imperial')}
      >
        ft
      </button>
      <button
        type="button"
        aria-pressed={units === 'metric'}
        title="Show meters"
        onClick={() => onChange('metric')}
        className={btnClass(units === 'metric')}
      >
        m
      </button>
    </div>
  )
}
