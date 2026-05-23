'use client'

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TABLE_LENGTH_OPTIONS_FT, formatTableFootprint } from '@/lib/booth-planner/table-space'
import {
  tableOrientationLabel,
  type TableOrientation,
} from '@/lib/booth-planner/table-orientation'
import { ArrowLeftRight, ArrowUpDown, Ruler } from 'lucide-react'

export interface TableVendorRow {
  id: string
  vendorName: string
  boothLabel: string
  unitLabel: string
  tableLengthFt: number
  tableOrientation?: TableOrientation
}

interface TableVendorSpacingPanelProps {
  vendors: TableVendorRow[]
  onTableLengthChange: (vendorId: string, tableLengthFt: number) => void
  onTableOrientationChange?: (vendorId: string, orientation: TableOrientation) => void
  showOrientation?: boolean
}

export function TableVendorSpacingPanel({
  vendors,
  onTableLengthChange,
  onTableOrientationChange,
  showOrientation = false,
}: TableVendorSpacingPanelProps) {
  if (vendors.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Ruler className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900">Table booth sizes</p>
          <p className="text-xs text-amber-800 mt-0.5">
            Market-provided tables: every booth is <strong>(4&apos; + L + 3&apos;) × 4&apos;</strong>{' '}
            (e.g. 6&apos; table → 13&apos;×4&apos; space).
            {showOrientation && (
              <>
                {' '}
                Use orientation controls to set table length along E-W or N-S.
              </>
            )}
          </p>
        </div>
      </div>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {vendors.map((v) => {
          const orientation = v.tableOrientation ?? 'horizontal'
          const footprint = formatTableFootprint(v.tableLengthFt)
          return (
            <li
              key={v.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-100 bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{v.vendorName}</p>
                <dl className="mt-0.5 grid grid-cols-[auto_1fr] gap-x-2 text-[10px] text-gray-500 leading-snug">
                  <dt>Booth</dt>
                  <dd className="truncate tabular-nums">{v.boothLabel}</dd>
                  <dt>Unit</dt>
                  <dd className="truncate">{v.unitLabel}</dd>
                  <dt>Footprint</dt>
                  <dd className="truncate tabular-nums">{footprint}</dd>
                </dl>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {showOrientation && onTableOrientationChange && (
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant={orientation === 'horizontal' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2 text-xs gap-1"
                      title={tableOrientationLabel('horizontal')}
                      aria-label={`Horizontal table for ${v.vendorName}`}
                      aria-pressed={orientation === 'horizontal'}
                      onClick={() => onTableOrientationChange(v.id, 'horizontal')}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" />
                      E-W
                    </Button>
                    <Button
                      type="button"
                      variant={orientation === 'vertical' ? 'default' : 'outline'}
                      size="sm"
                      className="h-8 px-2 text-xs gap-1"
                      title={tableOrientationLabel('vertical')}
                      aria-label={`Vertical table for ${v.vendorName}`}
                      aria-pressed={orientation === 'vertical'}
                      onClick={() => onTableOrientationChange(v.id, 'vertical')}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      N-S
                    </Button>
                  </div>
                )}
                <Label htmlFor={`table-len-${v.id}`} className="sr-only">
                  Table length for {v.vendorName}
                </Label>
                <Select
                  value={String(v.tableLengthFt)}
                  onValueChange={(val) => {
                    if (val !== null) onTableLengthChange(v.id, Number(val))
                  }}
                >
                  <SelectTrigger id={`table-len-${v.id}`} className="h-8 w-[88px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_LENGTH_OPTIONS_FT.map((ft) => (
                      <SelectItem key={ft} value={String(ft)}>
                        {ft}&apos; table
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-[10px] font-medium text-amber-800 whitespace-nowrap">
                  {footprint}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
