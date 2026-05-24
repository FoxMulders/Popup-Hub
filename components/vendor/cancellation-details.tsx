import { Badge } from '@/components/ui/badge'
import type { PaymentStatus } from '@/types/database'
import { marketStatusBadge } from '@/lib/theme/market'

interface CancellationDetailsProps {
  reasonLabel: string | null
  paymentStatus: PaymentStatus
  compact?: boolean
}

function refundStatusLabel(paymentStatus: PaymentStatus): { label: string; className: string } {
  switch (paymentStatus) {
    case 'refunded':
      return { label: 'Refund completed', className: marketStatusBadge.success }
    case 'paid':
    case 'processing':
      return { label: 'Refund processing', className: marketStatusBadge.warning }
    case 'unpaid':
      return { label: 'No booth fee charged', className: marketStatusBadge.neutral }
    default:
      return { label: 'Refund pending', className: marketStatusBadge.neutral }
  }
}

export function CancellationDetails({
  reasonLabel,
  paymentStatus,
  compact,
}: CancellationDetailsProps) {
  const refund = refundStatusLabel(paymentStatus)

  if (compact) {
    return (
      <div className="mt-1.5 space-y-1 w-full">
        {reasonLabel && (
          <p className="text-[10px] text-red-700 leading-snug">
            <span className="font-semibold">Reason:</span> {reasonLabel}
          </p>
        )}
        <Badge className={`text-[9px] ${refund.className}`}>{refund.label}</Badge>
      </div>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-red-100 bg-red-50/80 px-3 py-2 text-xs space-y-1.5">
      <p className="font-bold uppercase tracking-wide text-red-700 text-[10px]">
        Event Canceled — Refund Processed
      </p>
      {reasonLabel && (
        <p className="text-red-800">
          <span className="font-semibold">Organizer reason:</span> {reasonLabel}
        </p>
      )}
      <Badge className={`text-[10px] ${refund.className}`}>{refund.label}</Badge>
    </div>
  )
}
