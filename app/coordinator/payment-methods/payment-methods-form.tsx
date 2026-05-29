'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import {
  buildSquareOAuthAuthorizeUrl,
  getSquareAppId,
  getSquareOAuthRedirectUri,
  isSquareProductionEnvironment,
} from '@/lib/square/connect-url'

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
  defaultEventPaymentFlags: {
    accepts_credit_card: boolean
    accepts_etransfer: boolean
    accepts_cash: boolean
  }
}

interface PaymentMethodsFormProps {
  userId: string
  squareOauthUrl: string | null
  squareEnvironmentLabel: string
  squareRedirectUri: string | null
  squareAppId: string | null
  showDevSandboxBypass: boolean
}

export function PaymentMethodsForm({
  userId,
  squareOauthUrl,
  squareEnvironmentLabel,
  squareRedirectUri,
  squareAppId,
  showDevSandboxBypass,
}: PaymentMethodsFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [settings, setSettings] = useState<PaymentSettingsState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, startSave] = useTransition()
  const [stripeLoading, setStripeLoading] = useState(false)
  const [topUpLoading, setTopUpLoading] = useState(false)

  const [etransferEmail, setEtransferEmail] = useState('')
  const [offlineInstructions, setOfflineInstructions] = useState('')
  const [flags, setFlags] = useState({
    accepts_credit_card: true,
    accepts_etransfer: false,
    accepts_cash: false,
  })

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
      .then((res) => res.json())
      .then((data: PaymentSettingsState) => {
        setSettings(data)
        setEtransferEmail(data.etransferPaymentEmail ?? '')
        setOfflineInstructions(
          data.paymentInstructions ?? data.offlinePaymentInstructions ?? ''
        )
        setFlags(data.defaultEventPaymentFlags)
      })
      .catch(() => toast.error('Could not load payment settings'))
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

  if (loading || !settings) {
    return <p className="text-sm text-muted-foreground">Loading payment settings…</p>
  }

  return (
    <div className="space-y-6">
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
              <p className="text-xs text-muted-foreground">
                Square environment: {squareEnvironmentLabel}
              </p>
              {squareRedirectUri ? (
                <p className="text-xs text-muted-foreground">
                  OAuth redirect: <code className="break-all">{squareRedirectUri}</code>
                </p>
              ) : null}
              <ConnectSquareButton oauthUrl={squareOauthUrl} />
            </>
          ) : (
            <p className="text-sm text-harvest-800">
              Configure <code>NEXT_PUBLIC_SQUARE_APP_ID</code> and{' '}
              <code>NEXT_PUBLIC_APP_URL</code> to enable Square OAuth.
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
          {settings.stripeOnboardingComplete ? (
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
          {settings.stripeOnboardingComplete ? (
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
              value={etransferEmail}
              onChange={(e) => setEtransferEmail(e.target.value)}
              placeholder="payments@yourmarket.ca"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offline-instructions">Instructions for vendors</Label>
            <Textarea
              id="offline-instructions"
              rows={4}
              value={offlineInstructions}
              onChange={(e) => setOfflineInstructions(e.target.value)}
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
        <Link href="/coordinator/dashboard">
          <Button type="button" variant="ghost">
            ← Back to dashboard
          </Button>
        </Link>
      </div>

      {showDevSandboxBypass ? (
        <p className="text-xs text-muted-foreground">Dev sandbox Square bypass available on legacy Square page.</p>
      ) : null}

      <input type="hidden" value={userId} readOnly aria-hidden />
      {!squareAppId ? null : null}
    </div>
  )
}
