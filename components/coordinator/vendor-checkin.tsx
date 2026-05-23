'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { CheckinQR } from '@/components/vendor/checkin-qr'
import { toast } from 'sonner'
import { CheckCircle2, Undo2, QrCode } from 'lucide-react'

interface CheckinApplication {
  id: string
  booth_number: number | null
  vendor: { full_name: string; phone: string | null }
  passport: { business_name: string } | null
  category: { name: string } | null
  checked_in: boolean
}

interface VendorCheckinProps {
  eventId: string
  applications: CheckinApplication[]
}

export function VendorCheckin({ eventId, applications: initial }: VendorCheckinProps) {
  const supabase = createClient()
  const [apps, setApps] = useState(initial)
  const [loading, setLoading] = useState<string | null>(null)

  const checkedInCount = apps.filter((a) => a.checked_in).length
  const totalCount = apps.length

  async function toggleCheckin(appId: string, currentValue: boolean) {
    setLoading(appId)
    const newValue = !currentValue
    const { error } = await supabase
      .from('booth_applications')
      .update({ checked_in: newValue })
      .eq('id', appId)
      .eq('event_id', eventId)

    if (error) {
      toast.error('Failed to update check-in status')
    } else {
      setApps((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, checked_in: newValue } : a))
      )
      if (newValue) toast.success('Vendor checked in ✓')
    }
    setLoading(null)
  }

  const sorted = [...apps].sort((a, b) => {
    if (a.checked_in !== b.checked_in) return a.checked_in ? 1 : -1
    const aN = a.booth_number ?? 9999
    const bN = b.booth_number ?? 9999
    return aN - bN
  })

  return (
    <div className="space-y-4">
      {/* Live counter */}
      <div className="sticky top-0 z-10 market-panel p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-heading text-2xl font-bold text-sage-700">
              {checkedInCount} / {totalCount}
            </p>
            <p className="text-xs text-muted-foreground">vendors checked in</p>
          </div>
          <div className="h-12 w-12 rounded-full bg-sage-100 flex items-center justify-center">
            <CheckCircle2 className="h-6 w-6 text-sage-600" />
          </div>
        </div>
        {totalCount > 0 && (
          <div className="mt-3 h-2 rounded-full bg-canvas border border-stone-200">
            <div
              className="h-2 rounded-full bg-forest transition-all duration-200"
              style={{ width: `${Math.round((checkedInCount / totalCount) * 100)}%` }}
            />
          </div>
        )}
      </div>

      {/* Vendor list */}
      <div className="space-y-2">
        {sorted.map((app) => {
          const displayName = app.passport?.business_name ?? app.vendor.full_name
          const isLoading = loading === app.id

          return (
            <div
              key={app.id}
              className={`rounded-xl border-2 p-4 flex items-center gap-3 transition-all duration-200 ${
                app.checked_in
                  ? 'bg-canvas border-stone-200 opacity-70'
                  : 'bg-card border-stone-200 shadow-[var(--shadow-market)]'
              }`}
            >
              {/* Booth badge */}
              <div className="shrink-0">
                {app.booth_number != null ? (
                  <div className="h-11 w-11 rounded-lg bg-harvest-100 text-harvest-800 flex items-center justify-center text-sm font-bold">
                    {app.booth_number}
                  </div>
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-canvas text-muted-foreground flex items-center justify-center text-xs border border-stone-200">
                    —
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-base truncate ${app.checked_in ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {displayName}
                </p>
                {app.passport && (
                  <p className="text-xs text-muted-foreground truncate">{app.vendor.full_name}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {app.category && (
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      {app.category.name}
                    </Badge>
                  )}
                  {app.vendor.phone && (
                    <a
                      href={`tel:${app.vendor.phone}`}
                      className="text-sm text-forest min-h-11 inline-flex items-center hover:underline"
                    >
                      {app.vendor.phone}
                    </a>
                  )}
                </div>
              </div>

              {/* Action */}
              <div className="shrink-0 flex items-center gap-1.5">
                {/* QR Code button */}
                <Dialog>
                  <DialogTrigger
                    render={
                      <Button
                        size="icon"
                        variant="outline"
                        className="touch-target text-muted-foreground hover:text-forest hover:bg-sage-50"
                        title="Show QR Code"
                      />
                    }
                  >
                    <QrCode className="h-4 w-4" />
                  </DialogTrigger>
                  <DialogContent className="max-w-xs">
                    <DialogHeader>
                      <DialogTitle>Check-In QR Code</DialogTitle>
                    </DialogHeader>
                    <CheckinQR
                      eventId={eventId}
                      applicationId={app.id}
                      eventName={displayName}
                      boothNumber={app.booth_number}
                    />
                  </DialogContent>
                </Dialog>

                {app.checked_in ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11 gap-1.5 px-4"
                    onClick={() => toggleCheckin(app.id, app.checked_in)}
                    disabled={isLoading}
                  >
                    <Undo2 className="h-4 w-4" />
                    Undo
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="gap-1.5 min-h-11 min-w-[7.5rem] px-4"
                    onClick={() => toggleCheckin(app.id, app.checked_in)}
                    disabled={isLoading}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isLoading ? '…' : 'Check In'}
                  </Button>
                )}
              </div>
            </div>
          )
        })}

        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center">
            <p className="text-sm text-muted-foreground">No approved vendors yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
