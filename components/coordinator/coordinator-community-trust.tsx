'use client'



import { useState } from 'react'

import { ShieldCheck, Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'

import { toast } from 'sonner'

import { REQUIRED_VOUCHES } from '@/lib/coordinator/escrow-policy'



type CoordinatorCommunityTrustBannerProps = {

  escrowExempt: boolean

  hasVerifiedBusinessTaxId?: boolean

  vouchCount?: number

}



export function CoordinatorCommunityTrustBanner({

  escrowExempt,

  hasVerifiedBusinessTaxId = false,

  vouchCount = 0,

}: CoordinatorCommunityTrustBannerProps) {

  if (escrowExempt) {

    return (

      <div className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-3 text-sm text-sage-950">

        <div className="flex items-start gap-2">

          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sage-700" aria-hidden />

          <div>

            <p className="font-medium">Full payout access</p>

            <p className="mt-1 text-xs text-sage-900/80">

              {hasVerifiedBusinessTaxId

                ? 'Your verified business tax ID unlocks full booth payouts after each market.'

                : 'Community trust unlocked — booth payouts settle in full after each market.'}

            </p>

          </div>

        </div>

      </div>

    )

  }



  const vouchesRemaining = Math.max(0, REQUIRED_VOUCHES - vouchCount)



  return (

    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">

      <div className="flex items-start gap-2">

        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />

        <div>

          <p className="font-medium">Protected payout period</p>

          <p className="mt-1 text-xs text-amber-900/85">

            As a new organizer, 75% of booth fees are held until 24 hours after each market completes

            successfully. You still receive 25% upfront for venue deposits. Add a verified business tax ID

            or earn {vouchesRemaining} more vendor vouch{vouchesRemaining === 1 ? '' : 'es'} to unlock

            full payouts early.

          </p>

        </div>

      </div>

    </div>

  )

}



type VendorCoordinatorVouchButtonProps = {

  coordinatorId: string

  coordinatorName?: string | null

  disabled?: boolean

}



export function VendorCoordinatorVouchButton({

  coordinatorId,

  coordinatorName,

  disabled = false,

}: VendorCoordinatorVouchButtonProps) {

  const [loading, setLoading] = useState(false)

  const [vouched, setVouched] = useState(false)



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

        vouchCount?: number

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

          `Thanks — your vouch was recorded${data.vouchCount ? ` (${data.vouchCount}/${REQUIRED_VOUCHES})` : ''}.`

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

