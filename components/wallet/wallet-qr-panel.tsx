'use client'

import { WalletQrDisplay } from '@/components/wallet/wallet-qr-display'
import { WalletDoorCopyButton } from '@/components/wallet/wallet-door-copy-button'
import { cn } from '@/lib/utils'

interface WalletQrPanelProps {
  title: string
  qrPayload: string
  /** Short value for clipboard (usually patron user id). */
  copyValue: string
  copyLabel?: string
  ariaLabel: string
  className?: string
}

/** Centered QR block sized for phone viewports — no horizontal scroll from long URLs. */
export function WalletQrPanel({
  title,
  qrPayload,
  copyValue,
  copyLabel = 'Copy wallet ID',
  ariaLabel,
  className,
}: WalletQrPanelProps) {
  return (
    <div className={cn('rounded-xl border bg-canvas p-3 text-center sm:p-4', className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <WalletQrDisplay value={qrPayload} ariaLabel={ariaLabel} className="mt-3" />
      <p className="mt-3 hidden max-w-full break-all font-mono text-[10px] leading-relaxed text-muted-foreground sm:block">
        {qrPayload}
      </p>
      <WalletDoorCopyButton
        value={copyValue}
        label={copyLabel}
        className="mt-3 w-full max-w-xs min-h-11 sm:w-auto"
      />
    </div>
  )
}
