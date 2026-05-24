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
import { WalletQrScanner } from '@/components/coordinator/wallet-qr-scanner'
import type { WalletDepositRequest, WalletWithdrawalRequest, Profile } from '@/types/database'
import { Banknote, CheckCircle, Camera, Loader2, QrCode, ScanLine, Undo2 } from 'lucide-react'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000]

interface PendingRow extends WalletDepositRequest {
  profiles?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

interface PendingWithdrawalRow extends WalletWithdrawalRequest {
  profiles?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

interface DoorWalletTopUpProps {
  eventId?: string
  initialUserId?: string | null
}

export function DoorWalletTopUp({ eventId, initialUserId }: DoorWalletTopUpProps) {
  const [scanInput, setScanInput] = useState(initialUserId ?? '')
  const [amountCents, setAmountCents] = useState(1000)
  const [customDollars, setCustomDollars] = useState('')
  const [crediting, setCrediting] = useState(false)
  const [lastCredit, setLastCredit] = useState<{
    name: string
    amountCents: number
    newBalance: number
  } | null>(null)
  const [pendingEtransfers, setPendingEtransfers] = useState<PendingRow[]>([])
  const [pendingReclaims, setPendingReclaims] = useState<PendingWithdrawalRow[]>([])
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [cashoutAmountCents, setCashoutAmountCents] = useState(1000)
  const [cashoutCustomDollars, setCashoutCustomDollars] = useState('')
  const [payingOut, setPayingOut] = useState(false)
  const [lastPayout, setLastPayout] = useState<{
    name: string
    amountCents: number
    newBalance: number
  } | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const resolvedUserId = parseWalletTopUpQrPayload(scanInput)

  const loadPending = useCallback(async () => {
    const params = eventId ? `?eventId=${eventId}` : ''
    const [depositsRes, reclaimsRes] = await Promise.all([
      fetch(`/api/coordinator/wallet-deposits${params}`),
      fetch(`/api/coordinator/wallet-withdrawals${params}`),
    ])
    const depositsJson = await depositsRes.json()
    const reclaimsJson = await reclaimsRes.json()
    if (depositsRes.ok) {
      setPendingEtransfers((depositsJson.pending ?? []) as PendingRow[])
    }
    if (reclaimsRes.ok) {
      setPendingReclaims((reclaimsJson.pending ?? []) as PendingWithdrawalRow[])
    }
  }, [eventId])

  useEffect(() => {
    void loadPending()
  }, [loadPending])

  useEffect(() => {
    if (initialUserId) {
      setScanInput(initialUserId)
    }
  }, [initialUserId])

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

  async function confirmReclaim(requestId: string) {
    setConfirmingId(requestId)
    try {
      const res = await fetch(`/api/coordinator/wallet-withdrawals/${requestId}/confirm`, {
        method: 'POST',
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Confirmation failed')
        return
      }
      toast.success('E-transfer reclaim marked as sent')
      await loadPending()
    } finally {
      setConfirmingId(null)
    }
  }

  async function payoutCash() {
    const dollars = cashoutCustomDollars
      ? parseFloat(cashoutCustomDollars)
      : cashoutAmountCents / 100
    const cents = cashoutCustomDollars ? Math.round(dollars * 100) : cashoutAmountCents

    if (!resolvedUserId) {
      toast.error('Paste or scan a valid patron wallet QR first')
      return
    }
    if (!Number.isFinite(cents) || cents < 100) {
      toast.error('Minimum payout is $1.00')
      return
    }

    setPayingOut(true)
    try {
      const res = await fetch('/api/coordinator/wallet-cashout', {
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
        toast.error(json.error ?? 'Cash payout failed')
        return
      }
      setLastPayout({
        name: json.shopper?.full_name ?? 'Patron',
        amountCents: cents,
        newBalance: json.newBalance,
      })
      toast.success(`Paid ${formatCents(cents)} in cash`)
      setScanInput('')
      setCashoutCustomDollars('')
    } finally {
      setPayingOut(false)
    }
  }

  return (
    <div className="space-y-6">
    <WalletQrScanner
      open={scannerOpen}
      onClose={() => setScannerOpen(false)}
      onScan={(payload) => {
        setScanInput(payload)
        toast.success('Patron wallet QR scanned')
      }}
    />
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
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="patron-qr"
                  className="min-h-11 pl-9 font-mono text-sm"
                  placeholder="Scan QR or paste wallet ID"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0 gap-1.5 px-3"
                onClick={() => setScannerOpen(true)}
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Scan</span>
              </Button>
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
            className="w-full min-h-12 gap-2 bg-forest hover:bg-forest-deep text-base"
            disabled={crediting || !resolvedUserId}
            onClick={creditCash}
          >
            {crediting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            Credit {formatCents(customDollars ? Math.round(parseFloat(customDollars) * 100) : amountCents)}
          </Button>

          <Button
            type="button"
            variant="secondary"
            className="w-full min-h-12 gap-2 sm:hidden"
            onClick={() => setScannerOpen(true)}
          >
            <Camera className="h-5 w-5" />
            Scan patron QR with camera
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

    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Undo2 className="h-5 w-5 text-harvest-600" />
            Cash payout (reclaim)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan the patron&apos;s wallet QR at exit, pay them cash, and debit their remaining
            balance.
          </p>

          <div className="space-y-1">
            <Label htmlFor="patron-qr-payout">Patron QR / wallet code</Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="patron-qr-payout"
                  className="min-h-11 pl-9 font-mono text-sm"
                  placeholder="Scan QR or paste wallet ID"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 shrink-0 gap-1.5 px-3"
                onClick={() => setScannerOpen(true)}
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Scan</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Cash to pay out</Label>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((cents) => (
                <button
                  key={`out-${cents}`}
                  type="button"
                  onClick={() => {
                    setCashoutAmountCents(cents)
                    setCashoutCustomDollars('')
                  }}
                  className={`rounded-lg border-2 px-3 py-2 text-sm font-semibold ${
                    !cashoutCustomDollars && cashoutAmountCents === cents
                      ? 'border-harvest-500 bg-harvest-50 text-harvest-800'
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
              value={cashoutCustomDollars}
              onChange={(e) => setCashoutCustomDollars(e.target.value)}
              className="min-h-11"
            />
          </div>

          <Button
            type="button"
            className="w-full min-h-11 gap-2 bg-harvest-600 hover:bg-harvest-700"
            disabled={payingOut || !resolvedUserId}
            onClick={payoutCash}
          >
            {payingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
            Pay out{' '}
            {formatCents(
              cashoutCustomDollars
                ? Math.round(parseFloat(cashoutCustomDollars) * 100)
                : cashoutAmountCents
            )}
          </Button>

          {lastPayout ? (
            <div className="rounded-lg border border-harvest-200 bg-harvest-50 px-4 py-3 text-sm">
              <p className="font-medium text-harvest-900">
                <CheckCircle className="mr-1 inline h-4 w-4" />
                {lastPayout.name} — {formatCents(lastPayout.amountCents)} paid in cash
              </p>
              <p className="text-harvest-800">New balance: {formatCents(lastPayout.newBalance)}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pending e-transfer reclaims</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Send Interac e-Transfer to the patron&apos;s email, then confirm here.
          </p>
          {pendingReclaims.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No pending reclaims.</p>
          ) : (
            pendingReclaims.map((row) => {
              const patron = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
              return (
                <div key={row.id} className="rounded-lg border p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{patron?.full_name ?? 'Patron'}</p>
                      <p className="text-xs text-muted-foreground">{row.payout_email ?? patron?.email}</p>
                    </div>
                    <Badge variant="outline">{formatCents(row.amount_cents)}</Badge>
                  </div>
                  {row.reference_code ? (
                    <p className="text-sm">
                      Reference:{' '}
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
                    onClick={() => confirmReclaim(row.id)}
                  >
                    {confirmingId === row.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Confirm e-transfer sent
                  </Button>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  )
}
