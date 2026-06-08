'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MIN_ROOM_DIMENSION_FT } from '@/components/coordinator/floor-plan-v2/state/room-canvas'

export interface InitialRoomModalProps {
  onConfirm: (widthFt: number, lengthFt: number) => void
}

const DEFAULT_WIDTH_FT = 50
const DEFAULT_LENGTH_FT = 50

export function InitialRoomModal({ onConfirm }: InitialRoomModalProps) {
  const [mounted, setMounted] = useState(false)
  const [widthFt, setWidthFt] = useState(DEFAULT_WIDTH_FT)
  const [lengthFt, setLengthFt] = useState(DEFAULT_LENGTH_FT)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [mounted])

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    onConfirm(
      Math.max(MIN_ROOM_DIMENSION_FT, Math.round(widthFt)),
      Math.max(MIN_ROOM_DIMENSION_FT, Math.round(lengthFt))
    )
  }

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="initial-room-modal-title"
      data-testid="initial-room-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[min(92dvh,640px)] w-full max-w-md overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <LayoutGrid className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="initial-room-modal-title"
              className="font-heading text-lg font-semibold text-foreground"
            >
              Create your first room
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the venue footprint before the CAD canvas opens. You can add more rooms later
              from the toolbar.
            </p>
          </div>
        </div>

        <fieldset className="space-y-4 border-0 p-0">
          <legend className="sr-only">Room dimensions</legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Width (ft)</span>
              <Input
                type="number"
                min={MIN_ROOM_DIMENSION_FT}
                step={1}
                value={widthFt}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setWidthFt(Number.isFinite(next) ? next : DEFAULT_WIDTH_FT)
                }}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-foreground">Length (ft)</span>
              <Input
                type="number"
                min={MIN_ROOM_DIMENSION_FT}
                step={1}
                value={lengthFt}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  setLengthFt(Number.isFinite(next) ? next : DEFAULT_LENGTH_FT)
                }}
                required
              />
            </label>
          </div>
        </fieldset>

        <Button type="submit" className="mt-6 w-full">
          Open layout designer
        </Button>
      </form>
    </div>
  )

  if (!mounted) return null
  return createPortal(modal, document.body)
}
