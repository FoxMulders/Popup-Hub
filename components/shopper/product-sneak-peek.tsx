'use client'

import { useState } from 'react'
import { formatCents } from '@/lib/square/client'
import type { VendorProduct } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

function formatPriceRange(p: VendorProduct): string | null {
  if (p.price_min_cents == null && p.price_max_cents == null) return null
  if (p.price_min_cents != null && p.price_max_cents != null) {
    if (p.price_min_cents === p.price_max_cents) return formatCents(p.price_min_cents)
    return `${formatCents(p.price_min_cents)} – ${formatCents(p.price_max_cents)}`
  }
  if (p.price_min_cents != null) return `From ${formatCents(p.price_min_cents)}`
  return `Up to ${formatCents(p.price_max_cents!)}`
}

interface ProductSneakPeekProps {
  products: (VendorProduct & { vendor_name?: string; vendor_id: string })[]
  eventId: string
  userId: string | null
}

export function ProductSneakPeek({ products, eventId, userId }: ProductSneakPeekProps) {
  const router = useRouter()
  const supabase = createClient()
  const [preorderProduct, setPreorderProduct] = useState<
    (VendorProduct & { vendor_name?: string; vendor_id: string }) | null
  >(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (products.length === 0) return null

  async function submitPreorder() {
    if (!preorderProduct || !userId) {
      router.push(`/login?redirectTo=${encodeURIComponent(`/events/${eventId}`)}`)
      return
    }
    setSubmitting(true)
    const { error } = await supabase.from('market_preorders').insert({
      event_id: eventId,
      vendor_id: preorderProduct.vendor_id,
      shopper_id: userId,
      product_id: preorderProduct.id,
      notes: notes.trim() || null,
    })
    setSubmitting(false)
    if (error) {
      toast.error('Could not submit pre-order')
      return
    }
    toast.success('Pre-order submitted — vendor will prepare for pickup')
    setPreorderProduct(null)
    setNotes('')
  }

  return (
    <section className="space-y-4">
      <h2 className="font-heading text-lg font-semibold">Sneak peek</h2>
      <p className="text-sm text-muted-foreground">Featured products from vendors at this market</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {products.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-xl border bg-white">
            {p.image_urls[0] && (
              <img src={p.image_urls[0]} alt={p.name} className="h-32 w-full object-cover" />
            )}
            <div className="p-3 space-y-2">
              <p className="font-semibold text-sm">{p.name}</p>
              {p.vendor_name && (
                <p className="text-xs text-muted-foreground">{p.vendor_name}</p>
              )}
              {formatPriceRange(p) && (
                <Badge variant="outline">{formatPriceRange(p)}</Badge>
              )}
              {p.sold_out ? (
                <Badge variant="destructive">Sold out</Badge>
              ) : p.flash_sale_until && new Date(p.flash_sale_until) > new Date() ? (
                <Badge className="bg-harvest-100 text-harvest-800">Flash sale</Badge>
              ) : null}
              {!p.sold_out && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-full min-h-10"
                  onClick={() => setPreorderProduct(p)}
                >
                  Pre-order for pickup
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!preorderProduct} onOpenChange={(o) => !o && setPreorderProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pre-order: {preorderProduct?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="preorder-notes">Notes for vendor (optional)</Label>
            <Input
              id="preorder-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Pickup time preference, size, etc."
            />
            <Button
              type="button"
              className="w-full min-h-11"
              disabled={submitting}
              onClick={submitPreorder}
            >
              {userId ? 'Submit pre-order' : 'Sign in to pre-order'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
