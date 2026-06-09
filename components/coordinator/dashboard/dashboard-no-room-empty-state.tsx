'use client'

import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MIN_ROOM_DIMENSION_FT } from '@/components/coordinator/floor-plan-v2/state/room-canvas'

export interface DashboardNoRoomEmptyStateProps {
  onConfirm: (widthFt: number, lengthFt: number) => void
}

const DEFAULT_WIDTH_FT = 50
const DEFAULT_LENGTH_FT = 50

export function DashboardNoRoomEmptyState({ onConfirm }: DashboardNoRoomEmptyStateProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const width = Number((form.elements.namedItem('widthFt') as HTMLInputElement).value)
    const length = Number((form.elements.namedItem('lengthFt') as HTMLInputElement).value)
    onConfirm(
      Math.max(MIN_ROOM_DIMENSION_FT, Math.round(width)),
      Math.max(MIN_ROOM_DIMENSION_FT, Math.round(length))
    )
  }

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-4 py-12 text-center"
      data-testid="dashboard-no-room-empty-state"
    >
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
        <LayoutGrid className="h-6 w-6" aria-hidden />
      </span>
      <h2 className="font-heading text-xl font-semibold text-foreground">Set up your floor plan</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Add your first room to open the booth layout designer. You can add more rooms later from
        the toolbar.
      </p>
      <form
        onSubmit={handleSubmit}
        className="mt-8 w-full max-w-sm rounded-xl border border-stone-200 bg-card p-5 text-left shadow-sm"
      >
        <fieldset className="space-y-4 border-0 p-0">
          <legend className="sr-only">Room dimensions</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Width (ft)</span>
              <Input
                name="widthFt"
                type="number"
                min={MIN_ROOM_DIMENSION_FT}
                step={1}
                defaultValue={DEFAULT_WIDTH_FT}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Length (ft)</span>
              <Input
                name="lengthFt"
                type="number"
                min={MIN_ROOM_DIMENSION_FT}
                step={1}
                defaultValue={DEFAULT_LENGTH_FT}
                required
              />
            </label>
          </div>
        </fieldset>
        <Button type="submit" className="mt-5 w-full">
          Open layout designer
        </Button>
      </form>
    </div>
  )
}
