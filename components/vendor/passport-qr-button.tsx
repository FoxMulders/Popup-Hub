'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { PassportVendorQr } from '@/components/vendor/passport-vendor-qr'
import { Stamp } from 'lucide-react'

interface PassportQrButtonProps {
  eventId: string
  vendorId: string
  eventName: string
  businessName?: string | null
}

export function PassportQrButton({
  eventId,
  vendorId,
  eventName,
  businessName,
}: PassportQrButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 text-xs border-harvest-200 text-harvest-700 hover:bg-harvest-50"
          />
        }
      >
        <Stamp className="h-3.5 w-3.5" />
        Passport QR
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Patron passport QR</DialogTitle>
        </DialogHeader>
        <PassportVendorQr
          eventId={eventId}
          vendorId={vendorId}
          eventName={eventName}
          businessName={businessName}
        />
      </DialogContent>
    </Dialog>
  )
}
