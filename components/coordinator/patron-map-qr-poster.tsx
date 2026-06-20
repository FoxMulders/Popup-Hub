'use client'

import QRCode from 'react-qr-code'

interface PatronMapQrPosterProps {
  mapUrl: string
  eventName: string
  /** When false, QR links to the market detail page instead of the floor plan. */
  hasFloorPlan?: boolean
  className?: string
}

/** Entrance poster block — scan to open live vendor lineup / floor plan on a phone. */
export function PatronMapQrPoster({
  mapUrl,
  eventName,
  hasFloorPlan = true,
  className,
}: PatronMapQrPosterProps) {
  const subtitle = hasFloorPlan
    ? 'Scan for the live vendor map & lineup'
    : 'Scan for today’s vendor lineup'

  return (
    <section
      className={`rounded-xl border-2 border-dashed border-forest/30 bg-white p-6 text-center print:break-inside-avoid ${className ?? ''}`}
      aria-label="Patron map QR poster"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Venue entrance
      </p>
      <h2 className="mt-1 font-heading text-lg font-semibold text-foreground">{eventName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mx-auto mt-4 inline-flex rounded-xl border bg-white p-3 shadow-sm">
        <QRCode value={mapUrl} size={160} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground break-all">{mapUrl}</p>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Print and post at registration — updates live as vendors check in.
      </p>
    </section>
  )
}
