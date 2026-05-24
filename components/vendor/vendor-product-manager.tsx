'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import type { VendorProduct } from '@/types/database'
import { formatCents } from '@/lib/square/client'
import {
  canAddFeaturedProduct,
  FREE_TIER_FEATURED_PRODUCT_LIMIT,
} from '@/lib/profile/premium-access'

interface VendorProductManagerProps {
  userId: string
  products: VendorProduct[]
  isBetaTester?: boolean
}

export function VendorProductManager({
  userId,
  products: initial,
  isBetaTester = false,
}: VendorProductManagerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [products, setProducts] = useState(initial)
  const [name, setName] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [saving, setSaving] = useState(false)

  async function addProduct() {
    if (!name.trim()) return

    const featuredCount = products.filter((product) => product.is_featured).length
    if (!canAddFeaturedProduct({ is_beta_tester: isBetaTester }, featuredCount)) {
      toast.error(
        `Free vendors can list up to ${FREE_TIER_FEATURED_PRODUCT_LIMIT} featured products. Founding vendors have unlimited slots.`
      )
      return
    }

    setSaving(true)
    const minCents = priceMin ? Math.round(parseFloat(priceMin) * 100) : null
    const { data, error } = await supabase
      .from('vendor_products')
      .insert({
        vendor_id: userId,
        name: name.trim(),
        price_min_cents: minCents,
        is_featured: true,
      })
      .select('*')
      .single()
    setSaving(false)
    if (error || !data) {
      toast.error('Could not add product')
      return
    }
    setProducts((p) => [...p, data as VendorProduct])
    setName('')
    setPriceMin('')
    toast.success('Featured product added')
    router.refresh()
  }

  async function toggleSoldOut(id: string, soldOut: boolean) {
    await supabase.from('vendor_products').update({ sold_out: soldOut }).eq('id', id)
    setProducts((list) =>
      list.map((p) => (p.id === id ? { ...p, sold_out: soldOut } : p))
    )
    if (soldOut) {
      await fetch('/api/vendor/product-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: id, alert_type: 'sold_out' }),
      })
    }
    router.refresh()
  }

  async function toggleFlashSale(id: string, active: boolean) {
    const flashUntil = active
      ? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
      : null
    await supabase
      .from('vendor_products')
      .update({ flash_sale_until: flashUntil })
      .eq('id', id)
    setProducts((list) =>
      list.map((p) => (p.id === id ? { ...p, flash_sale_until: flashUntil } : p))
    )
    if (active) {
      await fetch('/api/vendor/product-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: id, alert_type: 'flash_sale' }),
      })
      toast.success('Followers notified of flash sale')
    }
    router.refresh()
  }

  return (
    <div className="mt-8 rounded-2xl border bg-white p-6">
      <h2 className="text-lg font-semibold">Featured products</h2>
      <p className="mt-1 text-sm text-gray-500">
        Shoppers see these on market pages before they visit your booth.
        {isBetaTester
          ? ' Founding vendor — unlimited featured listings.'
          : ` Free tier: ${FREE_TIER_FEATURED_PRODUCT_LIMIT} featured products.`}
      </p>
      <ul className="mt-4 space-y-2">
        {products.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              {p.name}
              {p.price_min_cents != null && ` · ${formatCents(p.price_min_cents)}`}
              {p.sold_out && ' · Sold out'}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => toggleSoldOut(p.id, !p.sold_out)}
              >
                {p.sold_out ? 'Mark available' : 'Mark sold out'}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  toggleFlashSale(
                    p.id,
                    !(p.flash_sale_until && new Date(p.flash_sale_until) > new Date())
                  )
                }
              >
                {p.flash_sale_until && new Date(p.flash_sale_until) > new Date()
                  ? 'End flash sale'
                  : 'Flash sale (4h)'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="min-w-[140px] flex-1">
          <Label htmlFor="prod-name" className="sr-only">
            Product name
          </Label>
          <Input
            id="prod-name"
            placeholder="Product name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="w-24">
          <Input
            placeholder="$ min"
            value={priceMin}
            onChange={(e) => setPriceMin(e.target.value)}
          />
        </div>
        <Button
          type="button"
          disabled={
            saving ||
            !canAddFeaturedProduct(
              { is_beta_tester: isBetaTester },
              products.filter((product) => product.is_featured).length
            )
          }
          onClick={addProduct}
        >
          Add
        </Button>
      </div>
    </div>
  )
}
