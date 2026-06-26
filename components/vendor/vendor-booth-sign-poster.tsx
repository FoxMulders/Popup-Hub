'use client'

import Link from 'next/link'
import QRCode from 'react-qr-code'
import { MapPin, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { buildBoothSignProfileUrl } from '@/lib/vendor/booth-sign'

interface VendorBoothSignPosterProps {
  profileUrl: string
  eventName: string
  businessName: string
  boothNumber?: number | null
  logoUrl?: string | null
  categoryName?: string | null
  className?: string
}

export function VendorBoothSignPoster({
  profileUrl,
  eventName,
  businessName,
  boothNumber,
  logoUrl,
  categoryName,
  className,
}: VendorBoothSignPosterProps) {
  const initials = businessName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  function handleDownloadPng() {
    const svgEl = document.querySelector('[data-booth-sign-qr] svg')
    if (!svgEl) return

    const svgData = new XMLSerializer().serializeToString(svgEl)
    const canvas = document.createElement('canvas')
    const width = 1200
    const height = 1500
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.strokeStyle = '#d6d3d1'
    ctx.lineWidth = 8
    ctx.strokeRect(40, 40, width - 80, height - 80)

    ctx.fillStyle = '#1c1917'
    ctx.font = 'bold 56px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(businessName, width / 2, 180)

    if (boothNumber != null) {
      ctx.font = '36px sans-serif'
      ctx.fillStyle = '#57534e'
      ctx.fillText(`Booth ${boothNumber}`, width / 2, 250)
    }

    ctx.font = '28px sans-serif'
    ctx.fillText(eventName, width / 2, 310)

    if (categoryName) {
      ctx.fillStyle = '#78716c'
      ctx.fillText(categoryName, width / 2, 360)
    }

    const img = new Image()
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    img.onload = () => {
      const qrSize = 720
      ctx.drawImage(img, (width - qrSize) / 2, 420, qrSize, qrSize)
      ctx.fillStyle = '#1c1917'
      ctx.font = 'bold 40px sans-serif'
      ctx.fillText('Scan to visit us on the map', width / 2, 1200)
      ctx.font = '24px sans-serif'
      ctx.fillStyle = '#78716c'
      ctx.fillText('Favorite our shop · browse products · pay online', width / 2, 1260)
      ctx.font = '20px sans-serif'
      ctx.fillText('Passport collectors: ask us for our stamp QR', width / 2, 1320)

      const link = document.createElement('a')
      link.download = `booth-sign-${businessName.replace(/\s+/g, '-').toLowerCase()}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      URL.revokeObjectURL(blobUrl)
    }
    img.src = blobUrl
  }

  return (
    <section
      className={`mx-auto max-w-md rounded-2xl border-2 border-dashed border-forest/30 bg-white p-8 text-center print:max-w-none print:border-solid print:shadow-none ${className ?? ''}`}
      aria-label="Vendor booth sign"
    >
      <div className="mx-auto mb-4 flex justify-center">
        <VendorLogo src={logoUrl} alt="" fallback={initials} size="lg" />
      </div>
      <h1 className="font-heading text-2xl font-semibold text-foreground">{businessName}</h1>
      {boothNumber != null ? (
        <p className="mt-1 text-sm font-medium text-muted-foreground">Booth {boothNumber}</p>
      ) : null}
      <p className="mt-1 text-sm text-muted-foreground">{eventName}</p>
      {categoryName ? (
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{categoryName}</p>
      ) : null}

      <p className="mt-6 text-sm font-medium text-foreground">Scan to visit us on the map</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Favorite our shop · browse products · pay online
      </p>

      <div
        data-booth-sign-qr
        className="mx-auto mt-5 inline-flex rounded-xl border bg-white p-4 shadow-sm print:shadow-none"
      >
        <QRCode value={profileUrl} size={220} />
      </div>

      <p className="mt-4 break-all text-[10px] text-muted-foreground">{profileUrl}</p>
      <p className="mt-3 text-[10px] text-muted-foreground">
        Passport collectors: ask us for our stamp QR
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 print:hidden">
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <MapPin className="mr-1.5 h-3.5 w-3.5" />
          Print sign
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadPng}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download PNG
        </Button>
      </div>
    </section>
  )
}

export function resolveBoothSignProfileUrl(eventId: string, vendorId: string): string {
  return buildBoothSignProfileUrl(eventId, vendorId)
}
