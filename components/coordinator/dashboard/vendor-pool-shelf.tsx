'use client'

import { motion, useDragControls } from 'framer-motion'
import { GripVertical, Star, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VendorApplicationSnapshot } from './booth-placement-status'

import { VENDOR_DRAG_MIME } from '@/lib/coordinator/booth-placement-status'

interface VendorPoolShelfProps {
  vendors: VendorApplicationSnapshot[]
}

function VendorPoolCard({ vendor }: { vendor: VendorApplicationSnapshot }) {
  const dragControls = useDragControls()

  const payload = JSON.stringify({
    applicationId: vendor.id,
    vendorId: vendor.vendor_id,
    vendorName: vendor.vendorName,
    categoryName: vendor.categoryName,
  })

  return (
    <motion.div
      layout
      drag
      dragControls={dragControls}
      dragListener={false}
      dragSnapToOrigin
      whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: '0 12px 28px rgba(45,90,39,0.18)' }}
      transition={{ type: 'spring', stiffness: 520, damping: 28 }}
      className={cn(
        'group relative flex cursor-grab items-start gap-2 rounded-xl border border-stone-200 bg-white px-2.5 py-2',
        'shadow-sm ring-1 ring-stone-100 active:cursor-grabbing',
        'focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-2'
      )}
      draggable
      onDragStart={(e) => {
        const native = e as unknown as DragEvent
        native.dataTransfer?.setData(VENDOR_DRAG_MIME, payload)
        native.dataTransfer!.effectAllowed = 'copy'
      }}
      role="listitem"
      aria-label={`${vendor.vendorName ?? 'Vendor'} — drag to assign booth`}
    >
      <button
        type="button"
        className="mt-0.5 rounded p-0.5 text-stone-400 hover:text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        aria-label={`Drag handle for ${vendor.vendorName ?? 'vendor'}`}
        onPointerDown={(e) => dragControls.start(e)}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{vendor.vendorName ?? 'Vendor'}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {vendor.categoryName ?? 'Uncategorized'}
        </p>
        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-medium text-stone-600">
          {vendor.status === 'waitlisted' ? (
            <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-purple-900">
              <Star className="h-3 w-3" aria-hidden /> VIP waitlist
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded bg-stone-100 px-1.5 py-0.5">
              <User className="h-3 w-3" aria-hidden /> Approved
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function VendorPoolShelf({ vendors }: VendorPoolShelfProps) {
  const unplaced = vendors.filter((v) => v.booth_number == null)

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-terracotta-700">
          Available pool
        </h3>
        <span className="rounded-md bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-900">
          {unplaced.length}
        </span>
      </div>
      <p className="mb-3 text-[10px] leading-snug text-muted-foreground">
        Drag approved vendors onto open booths in the canvas. Status fills update live in telemetry.
      </p>
      {unplaced.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 px-3 py-3 text-xs text-muted-foreground">
          All approved vendors are placed on the floor plan.
        </p>
      ) : (
        <motion.ul layout className="space-y-2" role="list" aria-label="Available vendor pool">
          {unplaced.map((vendor) => (
            <VendorPoolCard key={vendor.id} vendor={vendor} />
          ))}
        </motion.ul>
      )}
    </div>
  )
}
