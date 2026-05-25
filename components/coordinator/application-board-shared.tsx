'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle } from 'lucide-react'
import { marketStatusBadge } from '@/lib/theme/market'

export function PassportVerificationBadge({
  isVerified,
  onVerify,
  verifying,
  compact,
}: {
  isVerified: boolean
  onVerify: () => void
  verifying: boolean
  compact?: boolean
}) {
  if (isVerified) {
    return (
      <Badge className={`${marketStatusBadge.neutral} ${compact ? 'text-[10px]' : 'text-xs'}`}>
        <CheckCircle className={`${compact ? 'h-2.5 w-2.5' : 'h-3 w-3'} mr-1`} />
        Verified
      </Badge>
    )
  }

  return (
    <div className={`flex ${compact ? 'flex-col gap-1.5' : 'flex-wrap items-center gap-2'}`}>
      <Badge className={`bg-stone-100 text-stone-600 ${compact ? 'text-[10px]' : 'text-xs'}`}>
        Unverified
      </Badge>
      <Button
        size="sm"
        variant="outline"
        className={`${compact ? 'min-h-9 text-[10px] px-2' : 'min-h-10 text-xs'} gap-1.5`}
        onClick={onVerify}
        disabled={verifying}
      >
        {verifying ? <span className="animate-pulse">Verifying…</span> : 'Verify Vendor Passport'}
      </Button>
    </div>
  )
}
