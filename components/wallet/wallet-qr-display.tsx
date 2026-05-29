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
   * Visual size in pixels of the SVG matrix itself. The component also
   * applies an explicit `w-32 h-32` (or computed equivalent) on the
   * outer card so layout stays stable even if the SVG fails to mount —
   * matches the spec's "explicit fallback dimensions" requirement.
   */
  size?: number
  /**
   * Accessible alt text. The QR image uses `role="img"` + this label
   * because react-qr-code emits a raw SVG without a built-in alt.
   */
  ariaLabel?: string
  className?: string
}

/**
 * Inline QR matrix renderer. Replaces the legacy
 * `walletTopUpQrImageUrl` flow (which proxied through
 * `api.qrserver.com` and failed silently when the third-party
 * service was unreachable, behind a corporate proxy, or rate-limited)
 * with a fully-local SVG render via `react-qr-code`.
 *
 * No network round-trip means no failure mode; scanners get a clean
 * matrix the instant the component paints. The fallback box keeps the
 * `w-32 h-32` floor even on the rare paint where `value` is empty,
 * so layout never collapses.
 */
export function WalletQrDisplay({
  value,
  size = 160,
  ariaLabel = 'Wallet QR code for door staff',
  className,
}: WalletQrDisplayProps) {
  if (!value) {
    return (
      <div
        className={cn(
          'mx-auto flex h-32 w-32 items-center justify-center rounded-lg border bg-stone-100 p-2 text-center text-[10px] text-muted-foreground',
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
        'mx-auto flex h-32 w-32 items-center justify-center rounded-lg border bg-white p-2',
        className
      )}
      role="img"
      aria-label={ariaLabel}
    >
      <QRCode
        value={value}
        size={size}
        // 100% lets the SVG fluidly fill the explicit-sized container
        // so the matrix scales up cleanly on retina without blurring,
        // while the parent enforces the `w-32 h-32` floor.
        style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
      />
    </div>
  )
}
