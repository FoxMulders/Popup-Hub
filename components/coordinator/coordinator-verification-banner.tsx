'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { RequestPublishAssistButton } from '@/components/coordinator/request-publish-assist-button'
import { usePublishAssistPending } from '@/hooks/use-publish-assist-pending'
import type { CoordinatorVerificationStatus } from '@/types/database'

interface CoordinatorVerificationBannerProps {
  verificationStatus: CoordinatorVerificationStatus
  organizationName?: string | null
  publishBlockReason?: string | null
  paymentCollectionBlockReason?: string | null
  squareConnected?: boolean
  stripeConnected?: boolean
  paymentTrustComplete?: boolean
  /** Draft market id — enables publish assist request when publishing is blocked. */
  eventId?: string | null
}

export function CoordinatorVerificationBanner({
  verificationStatus,
  organizationName,
  publishBlockReason,
  paymentCollectionBlockReason,
  squareConnected = false,
  stripeConnected = false,
  paymentTrustComplete = false,
  eventId = null,
}: CoordinatorVerificationBannerProps) {
  const [pending, startTransition] = useTransition()
  const [expanded, setExpanded] = useState(verificationStatus === 'unverified')
  const [orgName, setOrgName] = useState(organizationName ?? '')
  const { pending: assistPending, refresh: refreshAssist } = usePublishAssistPending(eventId)

  if (
    verificationStatus === 'verified' &&
    !publishBlockReason &&
    !paymentCollectionBlockReason
  ) {
    return null
  }

  if (!publishBlockReason && !paymentCollectionBlockReason && paymentTrustComplete) {
    return null
  }

  const isPending = verificationStatus === 'pending'
  const isRejected = verificationStatus === 'rejected'
  const paymentConnected = squareConnected || stripeConnected

  function submitVerification() {
    if (!orgName.trim()) {
      toast.error('Organization name is required.')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/coordinator/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: orgName,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit verification')
        return
      }

      toast.success(data.message ?? 'Verification submitted')
      window.location.reload()
    })
  }

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        isRejected
          ? 'border-terracotta-200 bg-terracotta-50'
          : isPending
            ? 'border-harvest-200 bg-harvest-50'
            : 'border-stone-200 bg-canvas'
      }`}
    >
      <div className="flex flex-wrap items-start gap-3">
        {isRejected || publishBlockReason ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-terracotta-700" aria-hidden />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-harvest-700" aria-hidden />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="text-sm font-medium text-foreground">
              {isRejected
                ? 'Organizer verification rejected'
                : isPending
                  ? 'Organizer verification pending review'
                  : 'Complete organizer onboarding'}
            </p>
            <p className="text-sm text-muted-foreground">
              {publishBlockReason ??
                paymentCollectionBlockReason ??
                (isPending
                  ? 'You can edit draft markets while we review your details. Offline payment collection unlocks after approval.'
                  : paymentConnected
                    ? 'Payment account connected — you can publish and collect card payments.'
                    : 'Connect Square or Stripe to publish and collect card payments, or submit your organization name for offline markets.')}
            </p>
          </div>

          {!paymentConnected && !publishBlockReason ? (
            <Link
              href="/coordinator/payment-methods"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              Connect Square or Stripe
            </Link>
          ) : null}

          {publishBlockReason && eventId ? (
            <RequestPublishAssistButton
              eventId={eventId}
              pending={assistPending}
              onRequested={() => void refreshAssist()}
            />
          ) : null}

          {(verificationStatus === 'unverified' ||
            verificationStatus === 'rejected' ||
            (isPending && !organizationName)) &&
          expanded ? (
            <div className="grid gap-3 sm:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="coordinator-org-name">Organization name</Label>
                <Input
                  id="coordinator-org-name"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Your market or business name"
                />
              </div>
              <div className="sm:col-span-2 flex flex-wrap gap-2">
                <Button type="button" onClick={submitVerification} disabled={pending}>
                  {pending ? 'Submitting…' : 'Save organization details'}
                </Button>
                {isPending ? (
                  <Button type="button" variant="outline" onClick={() => setExpanded(false)}>
                    Dismiss
                  </Button>
                ) : null}
              </div>
            </div>
          ) : verificationStatus !== 'verified' || publishBlockReason ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(true)}>
              {isPending ? 'Update organization details' : 'Add organization details'}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
