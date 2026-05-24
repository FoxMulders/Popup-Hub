'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatCents } from '@/lib/square/client'
import {
  BANKING_PORTAL_LINKS,
} from '@/lib/wallet/etransfer-config'
import { formatEtransferExpiryCountdown } from '@/lib/applications/etransfer-reference'
import { buildWalletTopUpQrPayload, walletTopUpQrImageUrl } from '@/lib/wallet/wallet-qr'
import type { WalletDepositRequest } from '@/types/database'
import { Banknote, Copy, ExternalLink, Loader2, QrCode, Send } from 'lucide-react'

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
  const qrUrl = walletTopUpQrImageUrl(userId, 220)

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
    <div className="space-y-4">
      {/* Cash at door */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Banknote className="h-4 w-4 text-forest" />
            Cash at the door
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Not comfortable with e-transfer or card? Give cash to staff at the entrance. They&apos;ll
            scan your wallet QR and add the exact amount you paid.
          </p>
          <div className="rounded-xl border bg-canvas p-4 text-center">
            <p className="mb-3 text-sm font-medium text-foreground">Show this QR at the door</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrUrl}
              alt="Wallet top-up QR code for door staff"
              width={220}
              height={220}
              className="mx-auto rounded-lg border bg-white p-2"
            />
            <p className="mt-3 break-all font-mono text-[10px] text-muted-foreground">{qrPayload}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => copyText('Wallet code', userId)}
            >
              <Copy className="h-3.5 w-3.5" />
              Copy wallet ID
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* E-transfer */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Send className="h-4 w-4 text-blue-600" />
            Interac e-Transfer
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Send an e-transfer from your online banking. We&apos;ll credit your wallet after a
            coordinator confirms receipt (usually within a few minutes at the event).
          </p>

          {!paymentEmail && !pending ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              E-transfer top-up is not configured yet — use cash at the door or card payment below.
            </p>
          ) : null}

          {loadingPending ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking pending requests…
            </div>
          ) : pending ? (
            <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
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
                  <dd className="font-semibold">{formatCents(pending.amount_cents)}</dd>
                </div>
                {paymentEmail ? (
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Send to
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{paymentEmail}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
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
                      <code className="rounded bg-white px-2 py-1 font-mono text-base font-bold tracking-widest">
                        {pending.reference_code}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => copyText('Reference code', pending.reference_code!)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-xs text-muted-foreground">
                Open your banking app, send the exact amount, and include the memo code so we can
                match your payment.
              </p>
            </div>
          ) : paymentEmail ? (
            <>
              <div className="flex flex-wrap gap-2">
                {TOP_UP_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setAmountCents(amount)}
                    className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                      amountCents === amount
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {formatCents(amount)}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-700"
                disabled={submitting}
                onClick={startEtransferRequest}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Get e-transfer instructions for {formatCents(amountCents)}
              </Button>
            </>
          ) : null}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Open your banking
            </p>
            <div className="flex flex-wrap gap-2">
              {BANKING_PORTAL_LINKS.map((bank) => (
                <a
                  key={bank.href}
                  href={bank.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  {bank.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
