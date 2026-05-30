'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatCents } from '@/lib/square/client'
import { BANKING_PORTAL_LINKS } from '@/lib/wallet/etransfer-config'
import { formatEtransferExpiryCountdown } from '@/lib/applications/etransfer-reference'
import { buildWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { WalletQrPanel } from '@/components/wallet/wallet-qr-panel'
import { WalletAmountChips } from '@/components/wallet/wallet-amount-chips'
import { WalletCardTitle } from '@/components/wallet/wallet-card-title'
import type { WalletDepositRequest } from '@/types/database'
import { Banknote, Copy, ExternalLink, Loader2, Send } from 'lucide-react'

const TOP_UP_AMOUNTS = [500, 1000, 2500, 5000]

interface AlternativeDepositPanelProps {
  userId: string
}

export function AlternativeDepositPanel({ userId }: AlternativeDepositPanelProps) {
  const [amountCents, setAmountCents] = useState(1000)
  const [submitting, setSubmitting] = useState(false)
  const [pending, setPending] = useState<WalletDepositRequest | null>(null)
  const [paymentEmail, setPaymentEmail] = useState<string | null>(null)
  const [loadingPending, setLoadingPending] = useState(true)

  const qrPayload = buildWalletTopUpQrPayload(userId)

  const loadPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const res = await fetch('/api/wallet/deposit-request')
      const json = await res.json()
      if (res.ok) {
        const rows = (json.pending ?? []) as WalletDepositRequest[]
        setPending(rows.find((r) => r.method === 'etransfer') ?? null)
        setPaymentEmail(json.paymentEmail ?? null)
      }
    } finally {
      setLoadingPending(false)
    }
  }, [])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  async function startEtransferRequest() {
    setSubmitting(true)
    try {
      const res = await fetch('/api/wallet/deposit-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not start e-transfer request')
        return
      }
      setPending(json.request as WalletDepositRequest)
      setPaymentEmail(json.paymentEmail ?? paymentEmail)
      toast.success('E-transfer instructions ready — send from your bank app')
    } finally {
      setSubmitting(false)
    }
  }

  function copyText(label: string, value: string) {
    void navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  return (
    <div className="min-w-0 space-y-4">
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="text-base font-semibold">
            <WalletCardTitle icon={<Banknote className="h-4 w-4 text-forest" />}>
              Cash at the door
            </WalletCardTitle>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Not comfortable with e-transfer or card? Give cash to staff at the entrance. They&apos;ll
            scan your wallet QR and add the exact amount you paid — or look you up by name at the desk
            if you don&apos;t have your phone.
          </p>
          <WalletQrPanel
            title="Show this QR at the door"
            qrPayload={qrPayload}
            copyValue={userId}
            ariaLabel="Wallet top-up QR code for door staff"
          />
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="text-base font-semibold">
            <WalletCardTitle icon={<Send className="h-4 w-4 text-blue-600" />}>
              Interac e-Transfer
            </WalletCardTitle>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Send an e-transfer from your online banking. We&apos;ll credit your wallet after a
            coordinator confirms receipt (usually within a few minutes at the event).
          </p>

          {!paymentEmail && !pending ? (
            <p className="rounded-lg border border-harvest-200 bg-harvest-50 px-3 py-2 text-sm leading-relaxed text-harvest-800">
              E-transfer top-up is not configured yet — use cash at the door or card payment below.
            </p>
          ) : null}

          {loadingPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking pending requests…
            </div>
          ) : pending ? (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-blue-300 bg-white">
                  Pending e-transfer
                </Badge>
                {pending.expires_at ? (
                  <span className="text-xs text-muted-foreground">
                    {formatEtransferExpiryCountdown(pending.expires_at)}
                  </span>
                ) : null}
              </div>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Amount
                  </dt>
                  <dd className="font-semibold tabular-nums">{formatCents(pending.amount_cents)}</dd>
                </div>
                {paymentEmail ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Send to
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-all font-medium">{paymentEmail}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0 px-2 touch-manipulation"
                        onClick={() => copyText('Email', paymentEmail)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </dd>
                  </div>
                ) : null}
                {pending.reference_code ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Memo / message (required)
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <code className="max-w-full break-all rounded bg-white px-2 py-1 font-mono text-sm font-bold tracking-wider sm:text-base">
                        {pending.reference_code}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0 px-2 touch-manipulation"
                        onClick={() => copyText('Reference code', pending.reference_code!)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Open your banking app, send the exact amount, and include the memo code so we can
                match your payment.
              </p>
            </div>
          ) : paymentEmail ? (
            <>
              <WalletAmountChips
                amounts={TOP_UP_AMOUNTS}
                selectedCents={amountCents}
                onSelect={setAmountCents}
                variant="blue"
              />
              <Button
                type="button"
                className="min-h-11 w-full touch-manipulation bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
                onClick={startEtransferRequest}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <span className="text-left leading-snug">
                  Get e-transfer instructions for {formatCents(amountCents)}
                </span>
              </Button>
            </>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Open your banking
            </p>
            <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-3">
              {BANKING_PORTAL_LINKS.map((bank) => (
                <a
                  key={bank.href}
                  href={bank.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-medium leading-tight hover:bg-muted touch-manipulation"
                >
                  {bank.label}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
