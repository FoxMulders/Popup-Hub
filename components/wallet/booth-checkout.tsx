'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatCents } from '@/lib/square/client'
import { buildWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'
import { WalletQrPanel } from '@/components/wallet/wallet-qr-panel'
import { WalletCardTitle } from '@/components/wallet/wallet-card-title'
import { Loader2, QrCode, Store } from 'lucide-react'

interface BoothCheckoutProps {
  balance: number
  userId: string
}

export function BoothCheckout({ balance, userId }: BoothCheckoutProps) {
  const router = useRouter()
  const [vendorId, setVendorId] = useState('')
  const [eventId, setEventId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [paying, setPaying] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const qrPayload = buildWalletTopUpQrPayload(userId)

  async function payAtBooth() {
    const dollars = parseFloat(amount)
    if (!vendorId.trim()) {
      toast.error('Enter the vendor ID from their booth QR')
      return
    }
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error('Enter a valid amount')
      return
    }
    const amountCents = Math.round(dollars * 100)
    if (amountCents > balance) {
      toast.error('Insufficient wallet balance')
      return
    }

    setPaying(true)
    try {
      const res = await fetch('/api/shopper/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor_id: vendorId.trim(),
          event_id: eventId.trim() || undefined,
          amount_cents: amountCents,
          description: description.trim() || undefined,
        }),
      })
      const data = (await res.json()) as { error?: string; balance?: number }
      if (!res.ok) {
        toast.error(data.error ?? 'Payment failed')
        return
      }
      toast.success(`Paid ${formatCents(amountCents)} from wallet`)
      setAmount('')
      setDescription('')
      router.refresh()
    } catch {
      toast.error('Payment failed')
    } finally {
      setPaying(false)
    }
  }

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="text-base font-semibold">
          <WalletCardTitle icon={<Store className="h-4 w-4 text-forest" />}>
            Pay at a booth
          </WalletCardTitle>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Scan a vendor&apos;s QR or enter their booth checkout code, then pay from your wallet balance.
        </p>

        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full touch-manipulation gap-2"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrCode className="h-4 w-4 shrink-0" />
          {showQr ? 'Hide' : 'Show'} my wallet QR
        </Button>

        {showQr ? (
          <WalletQrPanel
            title="Vendors and door staff can scan this to identify your wallet"
            qrPayload={qrPayload}
            copyValue={userId}
            ariaLabel="Your wallet QR code"
          />
        ) : null}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="vendor-id">Vendor ID</Label>
            <Input
              id="vendor-id"
              placeholder="From vendor booth QR"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="min-h-11 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-id">Event ID (optional)</Label>
            <Input
              id="event-id"
              placeholder="Links receipt to this market"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="min-h-11 font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booth-amount">Amount ($)</Label>
            <Input
              id="booth-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booth-desc">Note (optional)</Label>
            <Input
              id="booth-desc"
              placeholder="What you bought"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-11"
            />
          </div>
        </div>

        <Button
          type="button"
          className="min-h-11 w-full touch-manipulation bg-forest hover:bg-forest-deep"
          disabled={paying || balance <= 0}
          onClick={payAtBooth}
        >
          {paying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Pay from wallet
        </Button>
      </CardContent>
    </Card>
  )
}
