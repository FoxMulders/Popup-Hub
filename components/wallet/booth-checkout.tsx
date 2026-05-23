'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { formatCents } from '@/lib/square/client'
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

  const qrPayload = `popuphub://pay?shopper=${userId}`

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Store className="h-4 w-4 text-forest" />
          Pay at a booth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Scan a vendor&apos;s QR or enter their booth checkout code, then pay from your wallet balance.
        </p>

        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11 gap-2"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrCode className="h-4 w-4" />
          {showQr ? 'Hide' : 'Show'} my wallet QR
        </Button>

        {showQr && (
          <div className="rounded-lg border bg-canvas p-4 text-center">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Vendors can scan this to identify your wallet
            </p>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(qrPayload)}`}
              alt="Wallet QR code"
              width={160}
              height={160}
              className="mx-auto rounded-lg border bg-white p-2"
            />
            <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{userId}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="vendor-id">Vendor ID</Label>
            <Input
              id="vendor-id"
              placeholder="From vendor booth QR"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-id">Event ID (optional)</Label>
            <Input
              id="event-id"
              placeholder="Links receipt to this market"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="booth-amount">Amount ($)</Label>
            <Input
              id="booth-amount"
              type="number"
              min="0.01"
              step="0.01"
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
            />
          </div>
        </div>

        <Button
          type="button"
          className="w-full min-h-11 bg-forest hover:bg-forest-deep"
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
