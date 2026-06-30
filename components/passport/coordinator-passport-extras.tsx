'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CreditCard, Landmark, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { CoordinatorVerificationStatus } from '@/types/database'

interface CoordinatorVerificationState {
  verificationStatus: CoordinatorVerificationStatus
  organizationName: string | null
  publishBlockReason: string | null
  paymentCollectionBlockReason: string | null
  squareConnected: boolean
  stripeConnected: boolean
  paymentTrustComplete: boolean
}

export function CoordinatorPassportExtras() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [state, setState] = useState<CoordinatorVerificationState | null>(null)
  const [orgName, setOrgName] = useState('')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    fetch('/api/coordinator/verification')
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(json.error ?? 'Could not load organizer details')
        }
        return res.json() as Promise<CoordinatorVerificationState & {
          organizationName?: string | null
          verificationStatus?: CoordinatorVerificationStatus
        }>
      })
      .then((data) => {
        setState({
          verificationStatus: data.verificationStatus ?? 'unverified',
          organizationName: data.organizationName ?? null,
          publishBlockReason: data.publishBlockReason ?? null,
          paymentCollectionBlockReason: data.paymentCollectionBlockReason ?? null,
          squareConnected: data.squareConnected === true,
          stripeConnected: data.stripeConnected === true,
          paymentTrustComplete: data.paymentTrustComplete === true,
        })
        setOrgName(data.organizationName ?? '')
        setLoadError(null)
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Could not load organizer details'
        setLoadError(message)
      })
      .finally(() => setLoading(false))
  }, [])

  function saveOrganizationDetails() {
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
        toast.error(data.error ?? 'Could not save organization details')
        return
      }

      toast.success(data.message ?? 'Organization details saved')
      window.location.reload()
    })
  }

  const verificationStatus = state?.verificationStatus ?? 'unverified'
  const paymentConnected = (state?.squareConnected ?? false) || (state?.stripeConnected ?? false)

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-forest" />
            Organizer business profile
          </CardTitle>
          <CardDescription>
            Vendor passports cover booth categories and product photos. As an organizer, add your
            market organization and payment setup here instead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading organizer details…</p>
          ) : null}
          {loadError ? (
            <p className="rounded-lg border border-harvest-200 bg-harvest-50 px-3 py-2 text-sm text-harvest-900">
              {loadError}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="coordinator-passport-org">Organization name</Label>
            <Input
              id="coordinator-passport-org"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your market or business name"
            />
          </div>

          {state?.publishBlockReason || state?.paymentCollectionBlockReason ? (
            <p className="text-sm text-muted-foreground">
              {state.publishBlockReason ?? state.paymentCollectionBlockReason}
            </p>
          ) : verificationStatus === 'pending' ? (
            <p className="text-sm text-muted-foreground">
              Verification is pending review. You can edit draft markets while we review your
              details.
            </p>
          ) : verificationStatus === 'verified' ? (
            <p className="text-sm text-muted-foreground">Organizer verification is complete.</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={saveOrganizationDetails} disabled={pending}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save organization details
            </Button>
            {!paymentConnected ? (
              <Link
                href="/coordinator/payment-methods"
                className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Payment methods
              </Link>
            ) : (
              <Link
                href="/coordinator/payment-methods"
                className={cn(buttonVariants({ variant: 'outline', size: 'default' }))}
              >
                <Landmark className="mr-2 h-4 w-4" />
                Manage payments
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">
        Selling at other organizers&apos; markets?{' '}
        <Link href="/vendor/passport" className="font-medium text-forest underline">
          Set up your vendor passport
        </Link>{' '}
        separately — it includes categories, photos, and booth application details.
      </p>
    </div>
  )
}
