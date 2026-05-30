'use client'

import QRCode from 'react-qr-code'
import { cn } from '@/lib/utils'

interface WalletQrDisplayProps {
  /**
   * The encoded payload string. Pre-build via
   * `buildWalletTopUpQrPayload(userId)` so what's rendered matches what
   * door-staff scanners parse out the other side.
   */
  value: string
  /**
   * Accessible alt text. The QR image uses `role="img"` + this label
   * because react-qr-code emits a raw SVG without a built-in alt.
   */
  ariaLabel?: string
  className?: string
}

/**
 * Responsive QR matrix — scales to the container width on mobile (max 17rem)
 * without forcing horizontal scroll.
 */
export function WalletQrDisplay({
  value,
  ariaLabel = 'Wallet QR code for door staff',
  className,
}: WalletQrDisplayProps) {
  if (!value) {
    return (
      <div
        className={cn(
          'mx-auto flex aspect-square w-full max-w-[min(17rem,100%)] items-center justify-center rounded-xl border bg-stone-100 p-3 text-center text-[10px] text-muted-foreground',
          className
        )}
        role="img"
        aria-label="Wallet QR code unavailable"
      >
        QR unavailable
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mx-auto flex aspect-square w-full max-w-[min(17rem,100%)] items-center justify-center rounded-xl border bg-white p-3 sm:p-4',
        className
      )}
      role="img"
      aria-label={ariaLabel}
    >
      <QRCode
        value={value}
        size={256}
        className="h-full w-full"
        style={{ height: '100%', width: '100%', maxWidth: '100%' }}
      />
    </div>
  )
}
