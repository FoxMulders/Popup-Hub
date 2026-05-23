'use client'

import { useRef } from 'react'
import QRCode from 'react-qr-code'
import { generateCheckinToken } from '@/lib/checkin-token'
import { Button } from '@/components/ui/button'
import { Download, QrCode } from 'lucide-react'

interface CheckinQRProps {
  eventId: string
  applicationId: string
  eventName: string
  boothNumber: number | null
}

export function CheckinQR({ eventId, applicationId, eventName, boothNumber }: CheckinQRProps) {
  const svgRef = useRef<HTMLDivElement>(null)

  const token = generateCheckinToken(eventId, applicationId)
  const url =
    typeof window !== 'undefined'
      ? `${window.location.origin}/checkin/${token}`
      : `/checkin/${token}`

  function handleDownload() {
    const svgEl = svgRef.current?.querySelector('svg')
    if (!svgEl) return

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const canvas = document.createElement('canvas')
    const size = 400
    canvas.width = size
    canvas.height = size + 60

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
      ctx.fillText(eventName, size / 2, size + 22)
      if (boothNumber != null) {
        ctx.font = '13px sans-serif'
        ctx.fillStyle = '#6b7280'
        ctx.fillText(`Booth #${boothNumber}`, size / 2, size + 42)
      }

      const link = document.createElement('a')
      link.download = `checkin-qr-${eventName.replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      URL.revokeObjectURL(blobUrl)
    }
    img.src = blobUrl
  }

  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        <QrCode className="h-4 w-4 text-amber-500" />
        Scan at Registration
      </div>

      {/* QR Code */}
      <div
        ref={svgRef}
        className="rounded-xl border-2 border-gray-200 p-3 bg-white shadow-sm"
      >
        <QRCode value={url} size={180} />
      </div>

      {/* Event info */}
      <div className="text-center space-y-0.5">
        <p className="font-semibold text-gray-900 text-sm">{eventName}</p>
        {boothNumber != null && (
          <p className="text-xs text-amber-600 font-medium">Booth #{boothNumber}</p>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center max-w-[200px]">
        Show this QR code at the registration desk when you arrive.
      </p>

      <Button
        size="sm"
        variant="outline"
        onClick={handleDownload}
        className="gap-1.5 text-xs"
      >
        <Download className="h-3.5 w-3.5" />
        Download PNG
      </Button>
    </div>
  )
}
