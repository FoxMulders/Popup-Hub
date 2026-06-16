'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  coordinatorEventIdFromPath,
  coordinatorNavBackHref,
} from '@/lib/coordinator/coordinator-event-route'
import {
  Banknote,
  CheckCircle,
  CreditCard,
  Landmark,
  Loader2,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formatCents } from '@/lib/square/client'
import { ConnectSquareButton } from '@/app/coordinator/square-connect/connect-button'
import { DevSandboxConnectPanel } from '@/app/coordinator/square-connect/dev-sandbox-connect-panel'
import { SandboxSquareOAuthNotice } from '@/app/coordinator/square-connect/sandbox-oauth-notice'

interface PaymentSettingsState {
  walletBalanceCents: number
  walletBlocked: boolean
  walletGraceUntil: string | null
  balanceOwed?: number
  etransferPaymentEmail: string | null
  paymentInstructions?: string | null
  offlinePaymentInstructions: string | null
  squareConnected: boolean
  stripeConnected: boolean
  stripeOnboardingComplete: boolean
  stripeConfigured: boolean
  defaultEventPaymentFlags: {
    accepts_credit_card: boolean
    accepts_etransfer: boolean
    accepts_cash: boolean
  }
}

const DEFAULT_PAYMENT_FLAGS: PaymentSettingsState['defaultEventPaymentFlags'] = {
  accepts_credit_card: true,
  accepts_etransfer: false,
  accepts_cash: false,
}

const EMPTY_PAYMENT_SETTINGS: PaymentSettingsState = {
  walletBalanceCents: 0,
  walletBlocked: false,
  walletGraceUntil: null,
  balanceOwed: 0,
  etransferPaymentEmail: null,
  paymentInstructions: null,
  offlinePaymentInstructions: null,
  squareConnected: false,
  stripeConnected: false,
  stripeOnboardingComplete: false,
  stripeConfigured: false,
  defaultEventPaymentFlags: { ...DEFAULT_PAYMENT_FLAGS },
}

interface PaymentMethodsFormProps {
  userId: string
  squareOauthUrl: string | null
  squareOauthBuildError: string | null
  squareEnvironmentLabel: string
  squareRedirectUri: string | null
  showDevSandboxBypass: boolean
}

export function PaymentMethodsForm({
  userId,
  squareOauthUrl,
  squareOauthBuildError,
  squareEnvironmentLabel,
  squareRedirectUri,
  showDevSandboxBypass,
}: PaymentMethodsFormProps) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const backHref = coordinatorNavBackHref(pathname)
  const backOnEvent = coordinatorEventIdFromPath(pathname) != null
  const [settings, setSettings] = useState<PaymentSettingsState>(EMPTY_PAYMENT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()
  const [stripeLoading, setStripeLoading] = useState(false)
  const [topUpLoading, setTopUpLoading] = useState(false)

  const [etransferEmail, setEtransferEmail] = useState('')
  const [offlineInstructions, setOfflineInstructions] = useState('')
  const [flags, setFlags] = useState({ ...DEFAULT_PAYMENT_FLAGS })
  const userEditedRef = useRef({ etransferEmail: false, offlineInstructions: false })

  useEffect(() => {
    const stripeParam = searchParams.get('stripe')
    const walletParam = searchParams.get('wallet_topup')
    if (stripeParam === 'connected') toast.success('Stripe Connect onboarding updated')
    if (stripeParam === 'refresh') toast.message('Resume Stripe onboarding when ready')
    if (walletParam === 'success') toast.success('Wallet top-up submitted — balance updates after payment clears')
    if (walletParam === 'cancelled') toast.message('Wallet top-up cancelled')
    const invoiceParam = searchParams.get('platform_invoice')
    if (invoiceParam === 'success') toast.success('Platform fee invoice paid — balance reset')
    if (invoiceParam === 'cancelled') toast.message('Platform fee invoice cancelled')
  }, [searchParams])

  useEffect(() => {
    fetch('/api/coordinator/payment-settings')
      .then(async (res) => {
        if (!res.ok) {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(json.error ?? 'Could not load payment settings')
        }
        return res.json() as Promise<PaymentSettingsState>
      })
      .then((data) => {
        setSettings({
          ...EMPTY_PAYMENT_SETTINGS,
          ...data,
          defaultEventPaymentFlags: {
            ...DEFAULT_PAYMENT_FLAGS,
            ...(data.defaultEventPaymentFlags ?? {}),
          },
        })
        if (!userEditedRef.current.etransferEmail) {
          setEtransferEmail(data.etransferPaymentEmail ?? '')
        }
        if (!userEditedRef.current.offlineInstructions) {
          setOfflineInstructions(
            data.paymentInstructions ?? data.offlinePaymentInstructions ?? ''
          )
        }
        setFlags({
          ...DEFAULT_PAYMENT_FLAGS,
          ...(data.defaultEventPaymentFlags ?? {}),
        })
        setLoadError(null)
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Could not load payment settings'
        setLoadError(message)
        toast.error(message)
      })
      .finally(() => setLoading(false))
  }, [])

  function saveSettings() {
    startSave(async () => {
      const res = await fetch('/api/coordinator/payment-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          etransferPaymentEmail: etransferEmail,
          paymentInstructions: offlineInstructions,
          offlinePaymentInstructions: offlineInstructions,
          defaultEventPaymentFlags: flags,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not save settings')
        return
      }
      toast.success('Payment settings saved')
      router.refresh()
    })
  }

  async function connectStripe() {
    if (!settings.stripeConfigured) {
      toast.error('Stripe Connect is not enabled on this deployment yet')
      return
    }
    setStripeLoading(true)
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.url) {
        toast.error(json.error ?? 'Could not start Stripe onboarding')
        return
      }
      window.location.href = json.url
    } finally {
      setStripeLoading(false)
    }
  }

  async function topUpWallet(amountCents: number) {
    setTopUpLoading(true)
    try {
      const res = await fetch('/api/stripe/coordinator-wallet-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        toast.error(json.error ?? 'Could not start wallet top-up')
        return
      }
      window.location.href = json.url
    } finally {
      setTopUpLoading(false)
    }
  }

  return (
    <div className="space-y-6" aria-busy={loading}>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading saved payment settings…</p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-harvest-200 bg-harvest-50 px-3 py-2 text-sm text-harvest-900">
          {loadError} You can still enter payment details below — save when ready.
        </p>
      ) : null}
      <Card className="border-emerald-200/80">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-5 w-5 text-emerald-700" />
            Platform fees owed
          </CardTitle>
          <CardDescription>
            When you mark offline vendors as paid, Popup Hub adds 3% + $1.00 per booth to this balance.
            Invoices run when the balance exceeds $20 or at month-end.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-emerald-50 px-4 py-3">
            <p className="text-sm text-muted-foreground">Outstanding platform fees</p>
            <p className="font-heading text-2xl font-semibold text-forest">
              ${(settings.balanceOwed ?? 0).toFixed(2)} CAD
            </p>
            {settings.walletBlocked ? (
              <p className="mt-1 text-xs font-medium text-terracotta-800">
                Legacy wallet grace active — top up if prompted for older markets.
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-dashed px-4 py-3">
            <p className="text-sm text-muted-foreground">Legacy wallet (optional top-up)</p>
            <p className="font-medium">{formatCents(settings.walletBalanceCents)}</p>
          </div>
          {settings.stripeConfigured ? (
            <div className="flex flex-wrap gap-2">
              {[2500, 5000, 10000].map((cents) => (
                <Button
                  key={cents}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={topUpLoading}
                  onClick={() => topUpWallet(cents)}
                >
                  Top up {formatCents(cents)}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              Wallet top-up requires Stripe to be configured on this deployment.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-sage-600" />
            Square
          </CardTitle>
          <CardDescription>
            Card checkout with automatic 3% + $1.00 platform fee split.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {settings.squareConnected ? (
            <div className="flex items-center gap-2 rounded-lg bg-sage-50 p-3">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <p className="text-sm font-medium text-sage-700">Square account connected</p>
            </div>
          ) : squareOauthUrl ? (
            <>
              {squareEnvironmentLabel === 'Sandbox' ? <SandboxSquareOAuthNotice /> : null}
              <p className="text-xs text-muted-foreground">
                Square environment: {squareEnvironmentLabel}
              </p>
              {squareRedirectUri ? (
                <p className="text-xs text-muted-foreground">
                  OAuth redirect: <code className="break-all">{squareRedirectUri}</code>
                </p>
              ) : null}
              <ConnectSquareButton oauthUrl={squareOauthUrl} />
              {showDevSandboxBypass ? <DevSandboxConnectPanel /> : null}
            </>
          ) : (
            <p className="text-sm text-harvest-800">
              {squareOauthBuildError ? (
                <>
                  Square OAuth could not be initialized. Check server logs and verify{' '}
                  <code>NEXT_PUBLIC_SQUARE_APP_ID</code> (or{' '}
                  <code>NEXT_PUBLIC_SQUARE_CLIENT_ID</code> / <code>SQUARE_SANDBOX_CLIENT_ID</code>)
                  and <code>NEXT_PUBLIC_APP_URL</code>.
                </>
              ) : (
                <>
                  Configure <code>NEXT_PUBLIC_SQUARE_APP_ID</code> and{' '}
                  <code>NEXT_PUBLIC_APP_URL</code> to enable Square OAuth.
                </>
              )}
            </p>
          )}
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <Label htmlFor="accepts-credit-card">Accept credit card at markets</Label>
            <Switch
              id="accepts-credit-card"
              checked={flags.accepts_credit_card}
              onCheckedChange={(checked) =>
                setFlags((f) => ({ ...f, accepts_credit_card: checked }))
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Uses Square and/or Stripe Connect when connected below.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-5 w-5 text-indigo-600" />
            Stripe Connect
          </CardTitle>
          <CardDescription>
            Alternative card checkout routed to your connected Stripe account with platform fee
            retained automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!settings.stripeConfigured ? (
            <p className="text-sm text-harvest-800">
              Stripe Connect is not enabled on this deployment yet. Card checkout is still
              available through Square above. To enable Stripe, set{' '}
              <code>STRIPE_SECRET_KEY</code> in environment variables and redeploy.
            </p>
          ) : settings.stripeOnboardingComplete ? (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 p-3">
              <CheckCircle className="h-5 w-5 text-indigo-600" />
              <p className="text-sm font-medium text-indigo-900">Stripe Connect active</p>
            </div>
          ) : (
            <Button type="button" onClick={connectStripe} disabled={stripeLoading}>
              {stripeLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Connect Stripe
            </Button>
          )}
          {settings.stripeConfigured && settings.stripeOnboardingComplete ? (
            <p className="text-xs text-muted-foreground">
              Stripe Connect is available for credit card checkout alongside Square.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Landmark className="h-5 w-5 text-sky-700" />
            Offline payments
          </CardTitle>
          <CardDescription>
            Vendors pay you directly; platform fees accrue to your balance when you mark them paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="etransfer-email">E-Transfer deposit email</Label>
            <Input
              id="etransfer-email"
              type="email"
              value={etransferEmail ?? ''}
              onChange={(e) => {
                userEditedRef.current.etransferEmail = true
                setEtransferEmail(e.target.value)
              }}
              placeholder="payments@yourmarket.ca"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offline-instructions">Instructions for vendors</Label>
            <Textarea
              id="offline-instructions"
              rows={4}
              value={offlineInstructions ?? ''}
              onChange={(e) => {
                userEditedRef.current.offlineInstructions = true
                setOfflineInstructions(e.target.value)
              }}
              placeholder="Include where to send e-Transfers, who to pay cash to at load-in, and any memo/reference requirements."
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-sky-700" />
              <Label htmlFor="accepts-etransfer">E-Transfer</Label>
            </div>
            <Switch
              id="accepts-etransfer"
              checked={flags.accepts_etransfer}
              onCheckedChange={(checked) =>
                setFlags((f) => ({ ...f, accepts_etransfer: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-stone-700" />
              <Label htmlFor="accepts-cash">Cash</Label>
            </div>
            <Switch
              id="accepts-cash"
              checked={flags.accepts_cash}
              onCheckedChange={(checked) => setFlags((f) => ({ ...f, accepts_cash: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={saveSettings} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save payment settings
        </Button>
        <Link href={backHref}>
          <Button type="button" variant="ghost">
            {backOnEvent ? '← Back to event' : '← Back to Blueprint Studio'}
          </Button>
        </Link>
      </div>


      <input type="hidden" value={userId} readOnly aria-hidden />
    </div>
  )
}
