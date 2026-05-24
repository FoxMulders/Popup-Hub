'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { formatCents } from '@/lib/square/client'
import { formatEtransferExpiryCountdown } from '@/lib/applications/etransfer-reference'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import type { WalletDepositRequest, Profile } from '@/types/database'
import { Banknote, CheckCircle, Loader2, QrCode, ScanLine } from 'lucide-react'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000]

interface PendingRow extends WalletDepositRequest {
  profiles?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

interface DoorWalletTopUpProps {
  eventId?: string
}

export function DoorWalletTopUp({ eventId }: DoorWalletTopUpProps) {
  const [scanInput, setScanInput] = useState('')
  const [amountCents, setAmountCents] = useState(1000)
  const [customDollars, setCustomDollars] = useState('')
  const [crediting, setCrediting] = useState(false)
  const [lastCredit, setLastCredit] = useState<{
    name: string
    amountCents: number
    newBalance: number
  } | null>(null)
  const [pendingEtransfers, setPendingEtransfers] = useState<PendingRow[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const resolvedUserId = parseWalletTopUpQrPayload(scanInput)

  const loadPending = useCallback(async () => {
    const params = eventId ? `?eventId=${eventId}` : ''
    const res = await fetch(`/api/coordinator/wallet-deposits${params}`)
    const json = await res.json()
    if (res.ok) {
      setPendingEtransfers((json.pending ?? []) as PendingRow[])
    }
  }, [eventId])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  async function creditCash() {
    const dollars = customDollars ? parseFloat(customDollars) : amountCents / 100
    const cents = customDollars ? Math.round(dollars * 100) : amountCents

    if (!resolvedUserId) {
      toast.error('Paste or scan a valid patron wallet QR first')
      return
    }
    if (!Number.isFinite(cents) || cents < 100) {
      toast.error('Minimum top-up is $1.00')
      return
    }

    setCrediting(true)
    try {
      const res = await fetch('/api/coordinator/wallet-topup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrPayload: scanInput.trim(),
          amountCents: cents,
          eventId,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Top-up failed')
        return
      }
      setLastCredit({
        name: json.shopper?.full_name ?? 'Patron',
        amountCents: cents,
        newBalance: json.newBalance,
      })
      toast.success(`Added ${formatCents(cents)} to wallet`)
      setScanInput('')
      setCustomDollars('')
    } finally {
      setCrediting(false)
    }
  }

  async function confirmEtransfer(requestId: string) {
    setConfirmingId(requestId)
    try {
      const res = await fetch(`/api/coordinator/wallet-deposits/${requestId}/confirm`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Confirmation failed')
        return
      }
      toast.success('E-transfer confirmed and wallet credited')
      await loadPending()
    } finally {
      setConfirmingId(null)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <QrCode className="h-5 w-5 text-forest" />
            Cash at the door
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan the patron&apos;s wallet QR (or paste their code), enter the cash amount received,
            and credit their wallet instantly.
          </p>

          <div className="space-y-1">
            <Label htmlFor="patron-qr">Patron QR / wallet code</Label>
            <div className="relative">
              <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="patron-qr"
                className="min-h-11 pl-9 font-mono text-sm"
                placeholder="Scan QR or paste wallet ID"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
              />
            </div>
            {resolvedUserId ? (
              <p className="text-xs text-sage-700">Patron ID recognized</p>
            ) : scanInput.trim() ? (
              <p className="text-xs text-destructive">Could not read a wallet ID from this code</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Amount received</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((cents) => (
                <button
                  key={cents}
                  type="button"
                  onClick={() => {
                    setAmountCents(cents)
                    setCustomDollars('')
                  }}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
                    !customDollars && amountCents === cents
                      ? 'border-forest bg-forest/10 text-forest'
                      : 'border-stone-200'
                  }`}
                >
                  {formatCents(cents)}
                </button>
              ))}
            </div>
            <Input
              type="number"
              min="1"
              step="0.01"
              placeholder="Custom amount ($)"
              value={customDollars}
              onChange={(e) => setCustomDollars(e.target.value)}
              className="min-h-11"
            />
          </div>

          <Button
            type="button"
            className="w-full min-h-11 gap-2 bg-forest hover:bg-forest-deep"
            disabled={crediting || !resolvedUserId}
            onClick={creditCash}
          >
            {crediting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            Credit {formatCents(customDollars ? Math.round(parseFloat(customDollars) * 100) : amountCents)}
          </Button>

          {lastCredit ? (
            <div className="rounded-lg border border-sage-200 bg-sage-50 px-4 py-3 text-sm">
              <p className="font-medium text-green-900">
                <CheckCircle className="mr-1 inline h-4 w-4" />
                {lastCredit.name} — {formatCents(lastCredit.amountCents)} added
              </p>
              <p className="text-sage-800">New balance: {formatCents(lastCredit.newBalance)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending e-transfers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Confirm after you see the Interac deposit in your inbox. Include the memo code when
            matching.
          </p>
          {pendingEtransfers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No pending e-transfers.</p>
          ) : (
            pendingEtransfers.map((row) => {
              const patron = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
              return (
                <div key={row.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{patron?.full_name ?? 'Patron'}</p>
                      <p className="text-xs text-muted-foreground">{patron?.email}</p>
                    </div>
                    <Badge variant="outline">{formatCents(row.amount_cents)}</Badge>
                  </div>
                  {row.reference_code ? (
                    <p className="text-sm">
                      Memo:{' '}
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold">
                        {row.reference_code}
                      </code>
                    </p>
                  ) : null}
                  {row.expires_at ? (
                    <p className="text-xs text-muted-foreground">
                      {formatEtransferExpiryCountdown(row.expires_at)}
                    </p>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={confirmingId === row.id}
                    onClick={() => confirmEtransfer(row.id)}
                  >
                    {confirmingId === row.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Confirm e-transfer received
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
  )
}
