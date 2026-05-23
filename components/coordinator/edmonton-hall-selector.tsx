'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  EDMONTON_HALLS,
  getEdmontonHallById,
  type EdmontonHall,
} from '@/lib/data/edmonton-halls'
import { cn } from '@/lib/utils'

interface EdmontonHallSelectorProps {
  onHallSelect?: (hall: EdmontonHall | null) => void
  className?: string
}

export function EdmontonHallSelector({ onHallSelect, className }: EdmontonHallSelectorProps) {
  const [selectedHallId, setSelectedHallId] = useState('')

  const selectedHall = selectedHallId ? getEdmontonHallById(selectedHallId) : null
  const areaDisplay = selectedHall ? `${selectedHall.area.toLocaleString()} sq ft` : '0'

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value
    setSelectedHallId(id)
    onHallSelect?.(id ? getEdmontonHallById(id) ?? null : null)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(140px,40%)]">
        <div className="space-y-1">
          <Label htmlFor="edmonton-hall-select">Edmonton area hall</Label>
          <select
            id="edmonton-hall-select"
            value={selectedHallId}
            onChange={handleChange}
            className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 text-base transition-all duration-200 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">Select a hall...</option>
            {EDMONTON_HALLS.map((hall) => (
              <option key={hall.id} value={hall.id}>
                {hall.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="edmonton-hall-area">Total floor area</Label>
          <Input
            id="edmonton-hall-area"
            readOnly
            tabIndex={-1}
            value={areaDisplay}
            className="bg-muted/40 text-foreground"
          />
        </div>
      </div>
      {selectedHall && (
        <p className="text-xs text-muted-foreground">{selectedHall.location}</p>
      )}
    </div>
  )
}
