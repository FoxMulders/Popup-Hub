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
import { CheckinQR } from './checkin-qr'
import { QrCode } from 'lucide-react'

interface QRButtonProps {
  eventId: string
  applicationId: string
  eventName: string
  boothNumber: number | null
}

export function QRButton({ eventId, applicationId, eventName, boothNumber }: QRButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs border-harvest-200 text-harvest-700 hover:bg-harvest-50"
          />
        }
      >
        <QrCode className="h-3.5 w-3.5" />
        QR Code
      </DialogTrigger>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Check-In QR Code</DialogTitle>
        </DialogHeader>
        <CheckinQR
          eventId={eventId}
          applicationId={applicationId}
          eventName={eventName}
          boothNumber={boothNumber}
        />
      </DialogContent>
    </Dialog>
  )
}
