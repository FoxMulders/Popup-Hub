'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/lib/toast'
import { formatCents } from '@/lib/square/client'
import { BANKING_PORTAL_LINKS } from '@/lib/wallet/etransfer-config'
import { buildWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { WalletQrPanel } from '@/components/wallet/wallet-qr-panel'
import { WalletCardTitle } from '@/components/wallet/wallet-card-title'
import { formatEtransferExpiryCountdown } from '@/lib/applications/etransfer-reference'
import type { WalletWithdrawalRequest } from '@/types/database'
import {
  Banknote,
  CreditCard,
  ExternalLink,
  Loader2,
  Send,
  Undo2,
} from 'lucide-react'

interface WalletReclaimPanelProps {
  userId: string
  userEmail: string
  balanceCents: number
}

export function WalletReclaimPanel({ userId, userEmail, balanceCents }: WalletReclaimPanelProps) {
  const [loading, setLoading] = useState(true)
  const [availableCents, setAvailableCents] = useState(balanceCents)
  const [cardReclaimCents, setCardReclaimCents] = useState(0)
  const [pending, setPending] = useState<WalletWithdrawalRequest[]>([])
  const [etransferAmount, setEtransferAmount] = useState(balanceCents)
  const [payoutEmail, setPayoutEmail] = useState(userEmail)
  const [cardAmount, setCardAmount] = useState(0)
  const [submitting, setSubmitting] = useState<string | null>(null)

  const qrPayload = buildWalletTopUpQrPayload(userId)

  const loadReclaim = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/wallet/reclaim')
      const json = await res.json()
      if (res.ok) {
        setAvailableCents(json.availableCents ?? 0)
        setCardReclaimCents(json.cardReclaimCents ?? 0)
        setPending((json.pending ?? []) as WalletWithdrawalRequest[])
        setEtransferAmount(json.availableCents ?? 0)
        setCardAmount(json.cardReclaimCents ?? 0)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReclaim()
  }, [loadReclaim])

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading reclaim options…
      </div>
    )
  }

  if (availableCents <= 0 && pending.length === 0) {
    return null
  }

  async function startEtransferReclaim() {
    setSubmitting('etransfer')
    try {
      const res = await fetch('/api/wallet/withdrawal-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountCents: etransferAmount,
          payoutEmail,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not start e-transfer reclaim')
        return
      }
      toast.success('E-transfer reclaim submitted — staff will send your funds')
      await loadReclaim()
      window.location.reload()
    } finally {
      setSubmitting(null)
    }
  }

  async function refundToCard() {
    setSubmitting('card')
    try {
      const res = await fetch('/api/wallet/card-refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountCents: cardAmount }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Card refund failed')
        return
      }
      toast.success('Refund sent to your card')
      window.location.reload()
    } finally {
      setSubmitting(null)
    }
  }

  async function cancelPending(requestId: string) {
    setSubmitting(requestId)
    try {
      const res = await fetch(`/api/wallet/withdrawal-request?id=${requestId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not cancel reclaim')
        return
      }
      toast.success('Reclaim cancelled — balance restored')
      await loadReclaim()
      window.location.reload()
    } finally {
      setSubmitting(null)
    }
  }

  const pendingEtransfer = pending.find((row) => row.method === 'etransfer')

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold leading-snug text-foreground">Reclaim leftover balance</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          At the end of the event, get unused wallet funds back by cash, Interac e-Transfer, or card
          refund.
        </p>
        {availableCents > 0 ? (
          <p className="mt-2 text-sm font-medium text-foreground">
            Available to reclaim: {formatCents(availableCents)}
          </p>
        ) : null}
      </div>

      {pendingEtransfer ? (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Pending e-transfer reclaim</Badge>
              {pendingEtransfer.expires_at ? (
                <span className="text-xs text-muted-foreground">
                  {formatEtransferExpiryCountdown(pendingEtransfer.expires_at)}
                </span>
              ) : null}
            </div>
            <p className="text-sm">
              {formatCents(pendingEtransfer.amount_cents)} will be sent to{' '}
              <strong>{pendingEtransfer.payout_email ?? userEmail}</strong>
            </p>
            {pendingEtransfer.reference_code ? (
              <p className="text-xs text-muted-foreground">
                Reference:{' '}
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
                  {pendingEtransfer.reference_code}
                </code>
              </p>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-1.5 touch-manipulation"
              disabled={submitting === pendingEtransfer.id}
              onClick={() => cancelPending(pendingEtransfer.id)}
            >
              {submitting === pendingEtransfer.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Undo2 className="h-4 w-4" />
              )}
              Cancel reclaim
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {availableCents > 0 ? (
        <>
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
                Show this QR to staff at the exit. They&apos;ll scan it and pay you your remaining
                balance in cash.
              </p>
              <WalletQrPanel
                title="Show this QR for cash payout"
                qrPayload={qrPayload}
                copyValue={userId}
                ariaLabel="Wallet reclaim QR code for door staff"
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
              <p className="text-sm text-muted-foreground">
                Request an e-transfer payout. Event staff will send funds to your email after
                confirming.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="reclaim-amount">Amount to reclaim</Label>
                <Input
                  id="reclaim-amount"
                  type="number"
                  min={1}
                  step={0.01}
                  value={(etransferAmount / 100).toFixed(2)}
                  onChange={(e) =>
                    setEtransferAmount(Math.round(parseFloat(e.target.value || '0') * 100))
                  }
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="payout-email">Send to email</Label>
                <Input
                  id="payout-email"
                  type="email"
                  value={payoutEmail}
                  onChange={(e) => setPayoutEmail(e.target.value)}
                  className="min-h-11"
                />
              </div>
              <Button
                type="button"
                className="min-h-11 w-full touch-manipulation bg-blue-600 hover:bg-blue-700"
                disabled={submitting === 'etransfer' || etransferAmount < 100}
                onClick={startEtransferReclaim}
              >
                {submitting === 'etransfer' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Request {formatCents(etransferAmount)} by e-transfer
              </Button>
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

          {cardReclaimCents >= 100 ? (
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="px-4 pb-2 sm:px-6">
                <CardTitle className="text-base font-semibold">
                  <WalletCardTitle icon={<CreditCard className="h-4 w-4 text-sage-600" />}>
                    Refund to card
                  </WalletCardTitle>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
                <p className="text-sm text-muted-foreground">
                  Up to {formatCents(cardReclaimCents)} can be returned to the card you used to add
                  funds.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="card-refund-amount">Refund amount</Label>
                  <Input
                    id="card-refund-amount"
                    type="number"
                    min={1}
                    max={cardReclaimCents / 100}
                    step={0.01}
                    value={(cardAmount / 100).toFixed(2)}
                    onChange={(e) =>
                      setCardAmount(
                        Math.min(
                          cardReclaimCents,
                          Math.round(parseFloat(e.target.value || '0') * 100)
                        )
                      )
                    }
                    className="min-h-11"
                  />
                </div>
                <Button
                  type="button"
                  className="min-h-11 w-full touch-manipulation bg-sage-500 text-white hover:bg-green-600"
                  disabled={submitting === 'card' || cardAmount < 100}
                  onClick={refundToCard}
                >
                  {submitting === 'card' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Refund {formatCents(cardAmount)} to card
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
