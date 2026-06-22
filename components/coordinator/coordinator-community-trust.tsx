'use client'

import { useState } from 'react'
import { ShieldCheck, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  REQUIRED_COORDINATOR_VOUCHES,
  REQUIRED_VENDOR_VOUCHES,
} from '@/lib/coordinator/escrow-policy'

type CoordinatorCommunityTrustBannerProps = {
  escrowExempt: boolean
  vendorVouchCount?: number
  coordinatorVouchCount?: number
  /** @deprecated Use vendorVouchCount */
  vouchCount?: number
}

function VouchProgress({
  label,
  current,
  required,
}: {
  label: string
  current: number
  required: number
}) {
  const pct = Math.min(100, Math.round((current / required) * 100))

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {current}/{required}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-amber-200/80">
        <div
          className="h-full rounded-full bg-amber-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function CoordinatorCommunityTrustBanner({
  escrowExempt,
  vendorVouchCount,
  coordinatorVouchCount = 0,
  vouchCount,
}: CoordinatorCommunityTrustBannerProps) {
  const vendorCount = vendorVouchCount ?? vouchCount ?? 0
  const peerCount = coordinatorVouchCount ?? 0

  if (escrowExempt) {
    return (
      <div className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-950">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" aria-hidden />
          <div>
            <p className="font-medium">Full payout access</p>
            <p className="mt-1 text-xs text-sage-900/80">
              Community trust unlocked — booth payouts settle in full after each market.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const vendorRemaining = Math.max(0, REQUIRED_VENDOR_VOUCHES - vendorCount)
  const peerRemaining = Math.max(0, REQUIRED_COORDINATOR_VOUCHES - peerCount)

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <div className="flex items-start gap-2">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="font-medium">Protected payout period</p>
            <p className="mt-1 text-xs text-amber-900/85">
              As a new organizer, 75% of booth fees are held until 24 hours after each market completes
              successfully. You still receive 25% upfront for venue deposits. Earn community trust to
              unlock full payouts early — either {REQUIRED_COORDINATOR_VOUCHES} vouches from verified
              organizers or {REQUIRED_VENDOR_VOUCHES} from verified vendors.
            </p>
          </div>

          <div className="space-y-2">
            <VouchProgress
              label="Organizer vouches"
              current={peerCount}
              required={REQUIRED_COORDINATOR_VOUCHES}
            />
            <VouchProgress
              label="Vendor vouches"
              current={vendorCount}
              required={REQUIRED_VENDOR_VOUCHES}
            />
          </div>

          <p className="text-xs text-amber-900/75">
            {peerRemaining <= vendorRemaining
              ? `${peerRemaining} more organizer vouch${peerRemaining === 1 ? '' : 'es'} needed on the fastest path.`
              : `${vendorRemaining} more vendor vouch${vendorRemaining === 1 ? '' : 'es'} needed on the vendor path.`}
          </p>
        </div>
      </div>
    </div>
  )
}

type VendorCoordinatorVouchButtonProps = {
  coordinatorId: string
  coordinatorName?: string | null
  canVouch?: boolean
  disabled?: boolean
}

export function VendorCoordinatorVouchButton({
  coordinatorId,
  coordinatorName,
  canVouch = false,
  disabled = false,
}: VendorCoordinatorVouchButtonProps) {
  const [loading, setLoading] = useState(false)
  const [vouched, setVouched] = useState(false)

  if (!canVouch) {
    return null
  }

  async function handleVouch() {
    setLoading(true)
    try {
      const res = await fetch('/api/coordinator/vouch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinatorId }),
      })
      const data = (await res.json()) as {
        error?: string
        ok?: boolean
        coordinatorVerified?: boolean
        vendorVouchCount?: number
        vouchCount?: number
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not record vouch')
        return
      }

      setVouched(true)
      const count = data.vendorVouchCount ?? data.vouchCount

      if (data.coordinatorVerified) {
        toast.success('Organizer now has full payout access on Popup Hub.')
      } else {
        toast.success(
          `Thanks — your vouch was recorded${count != null ? ` (${count}/${REQUIRED_VENDOR_VOUCHES})` : ''}.`
        )
      }
    } catch {
      toast.error('Could not record vouch. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      disabled={disabled || loading || vouched}
      onClick={handleVouch}
    >
      {vouched
        ? 'Vouch recorded — thank you'
        : `Vouch for ${coordinatorName?.trim() || 'this organizer'}`}
    </Button>
  )
}

type CoordinatorPeerVouchButtonProps = {
  coordinatorId: string
  coordinatorName?: string | null
  canVouch?: boolean
  alreadyVouched?: boolean
  disabled?: boolean
}

export function CoordinatorPeerVouchButton({
  coordinatorId,
  coordinatorName,
  canVouch = false,
  alreadyVouched = false,
  disabled = false,
}: CoordinatorPeerVouchButtonProps) {
  const [loading, setLoading] = useState(false)
  const [vouched, setVouched] = useState(alreadyVouched)

  if (!canVouch) {
    return null
  }

  async function handleVouch() {
    setLoading(true)
    try {
      const res = await fetch('/api/coordinator/peer-vouch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinatorId }),
      })
      const data = (await res.json()) as {
        error?: string
        ok?: boolean
        coordinatorVerified?: boolean
        coordinatorVouchCount?: number
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not record vouch')
        return
      }

      setVouched(true)

      if (data.coordinatorVerified) {
        toast.success('Organizer now has full payout access on Popup Hub.')
      } else {
        toast.success(
          `Thanks — your vouch was recorded${
            data.coordinatorVouchCount != null
              ? ` (${data.coordinatorVouchCount}/${REQUIRED_COORDINATOR_VOUCHES})`
              : ''
          }.`
        )
      }
    } catch {
      toast.error('Could not record vouch. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      disabled={disabled || loading || vouched}
      onClick={handleVouch}
    >
      {vouched
        ? 'Organizer vouch recorded — thank you'
        : `Vouch for ${coordinatorName?.trim() || 'this organizer'}`}
    </Button>
  )
}
