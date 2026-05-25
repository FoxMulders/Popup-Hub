'use client'

import { useRef } from 'react'
import QRCode from 'react-qr-code'
import { buildPassportScanQrValue } from '@/lib/market-passport/scan-token'
import { Button } from '@/components/ui/button'
import { Download, Stamp } from 'lucide-react'

interface PassportVendorQrProps {
  eventId: string
  vendorId: string
  eventName: string
  businessName?: string | null
}

export function PassportVendorQr({
  eventId,
  vendorId,
  eventName,
  businessName,
}: PassportVendorQrProps) {
  const svgRef = useRef<HTMLDivElement>(null)
  const qrValue = buildPassportScanQrValue(eventId, vendorId)

  function handleDownload() {
    const svgEl = svgRef.current?.querySelector('svg')
    if (!svgEl) return

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const canvas = document.createElement('canvas')
    const size = 400
    canvas.width = size
    canvas.height = size + 72

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const img = new Image()
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)

    img.onload = () => {
      ctx.drawImage(img, 0, 0, size, size)
      ctx.fillStyle = '#1f2937'
      ctx.font = 'bold 16px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(businessName ?? eventName, size / 2, size + 24)
      ctx.font = '13px sans-serif'
      ctx.fillStyle = '#6b7280'
      ctx.fillText('Patron passport scan', size / 2, size + 48)

      const link = document.createElement('a')
      link.download = `passport-qr-${(businessName ?? eventName).replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      URL.revokeObjectURL(blobUrl)
    }
    img.src = blobUrl
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Stamp className="h-4 w-4 text-harvest-500" />
        Patron passport QR
      </div>

      <div
        ref={svgRef}
        className="rounded-xl border-2 border-stone-200 bg-white p-3 shadow-sm"
      >
        <QRCode value={qrValue} size={180} />
      </div>

      <div className="space-y-0.5 text-center">
        {businessName ? (
          <p className="text-sm font-semibold text-foreground">{businessName}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">{eventName}</p>
      </div>

      <p className="max-w-[220px] text-center text-xs text-muted-foreground">
        Display this at your booth so patrons can scan and stamp their passport.
      </p>

      <Button size="sm" variant="outline" onClick={handleDownload} className="gap-1.5 text-xs">
        <Download className="h-3.5 w-3.5" />
        Download PNG
      </Button>
    </div>
  )
}
