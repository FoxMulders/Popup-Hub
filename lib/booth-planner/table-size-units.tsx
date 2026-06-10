'use client'

import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export type TableSizeUnits = 'imperial' | 'metric'

const STORAGE_KEY = 'popup-hub:table-size-units'

export function formatTableSizeDisplay(ft: number, units: TableSizeUnits): string {
  if (units === 'metric') {
    const meters = ft * 0.3048
    return `${meters % 1 === 0 ? meters.toFixed(0) : meters.toFixed(1)} m`
  }
  return `${ft}′`
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
  }, [])

  const setUnits = useCallback((next: TableSizeUnits) => {
    setUnitsState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
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
