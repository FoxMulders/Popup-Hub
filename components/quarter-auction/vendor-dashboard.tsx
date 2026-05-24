'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Upload, Trophy } from 'lucide-react'
import type { AuctionCatalogItem, Profile, QuarterAuctionSettings } from '@/types/database'
import { statusLabel } from '@/lib/quarter-auction/state-machine'
import { formatCredits } from '@/lib/quarter-auction/credits'
import { formatCents } from '@/lib/square/client'
import { cn } from '@/lib/utils'

interface VendorQuarterAuctionProps {
  eventId: string
  vendorId: string
  isApproved: boolean
  items: AuctionCatalogItem[]
  settings: QuarterAuctionSettings
}

export function VendorQuarterAuction({
  eventId,
  vendorId,
  isApproved,
  items: initialItems,
  settings,
}: VendorQuarterAuctionProps) {
  const supabase = createClient()
  const [items, setItems] = useState(initialItems)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [retailDollars, setRetailDollars] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const myItems = items.filter((i) => i.vendor_id === vendorId)
  const sortedAll = [...items].sort((a, b) => a.queue_position - b.queue_position)
  const activeIdx = sortedAll.findIndex((i) =>
    ['active_price_setting', 'bidding_open', 'bidding_closed', 'drawing'].includes(i.status)
  )
  const currentItem = activeIdx >= 0 ? sortedAll[activeIdx] : null

  const completedMine = myItems.filter((i) => i.status === 'completed')

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `${vendorId}/auction-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('vendor-assets').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('vendor-assets').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } catch {
      toast.error('Image upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function submitItem(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      toast.error('Title is required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quarter-auction/${eventId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          image_url: imageUrl,
          retail_value_cents: retailDollars
            ? Math.round(parseFloat(retailDollars) * 100)
            : null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Could not submit item')
        return
      }
      setItems((prev) => [...prev, json.item])
      setTitle('')
      setDescription('')
      setRetailDollars('')
      setImageUrl(null)
      toast.success('Item submitted for coordinator approval')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isApproved) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Waiting for coordinator approval to participate in the quarter auction.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Live queue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sortedAll.length === 0 ? (
            <p className="text-sm text-muted-foreground">No catalog items yet.</p>
          ) : (
            sortedAll.map((item, idx) => {
              const isMine = item.vendor_id === vendorId
              const isCurrent = currentItem?.id === item.id
              const isUpcoming = activeIdx >= 0 && idx === activeIdx + 1 && isMine
              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3',
                    isCurrent && 'border-amber-400 bg-amber-50',
                    isUpcoming && 'border-forest/40 bg-forest/5'
                  )}
                >
                  <span className="text-xs font-mono text-muted-foreground w-6">#{idx + 1}</span>
                  {item.image_url && (
                    <Image
                      src={item.image_url}
                      alt=""
                      width={40}
                      height={40}
                      className="rounded object-contain bg-white"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {item.title}
                      {isMine && <span className="text-forest ml-1">(yours)</span>}
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {statusLabel(item.status)}
                    </Badge>
                  </div>
                  {isCurrent && <Badge className="bg-amber-500">Live now</Badge>}
                  {isUpcoming && <Badge variant="secondary">Up next</Badge>}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Submit auction item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitItem} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="item-title">Title</Label>
              <Input
                id="item-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                aria-required="true"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-desc">Description</Label>
              <Textarea
                id="item-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="retail">Retail value ($)</Label>
              <Input
                id="retail"
                type="number"
                min={0}
                step="0.01"
                value={retailDollars}
                onChange={(e) => setRetailDollars(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-image">Image</Label>
              <Input
                id="item-image"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleImageUpload}
                disabled={uploading}
                aria-describedby="item-image-hint"
              />
              <p id="item-image-hint" className="text-xs text-muted-foreground">
                JPEG, PNG, or WebP up to 5 MB
              </p>
              {imageUrl && (
                <Image
                  src={imageUrl}
                  alt="Preview of uploaded auction item"
                  width={120}
                  height={120}
                  className="mt-2 rounded-lg object-contain bg-slate-50"
                />
              )}
            </div>
            <Button type="submit" disabled={submitting || uploading} className="gap-1.5">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Submit for approval
            </Button>
          </form>
        </CardContent>
      </Card>

      {completedMine.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-amber-500" />
              Completed items
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {completedMine.map((item) => (
              <VendorWinPanel key={item.id} item={item} />
            ))}
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Patrons buy paddles for {formatCredits(settings.paddle_purchase_credits)} each.
      </p>
    </div>
  )
}

function VendorWinPanel({ item }: { item: AuctionCatalogItem }) {
  const [winner, setWinner] = useState<Profile | null>(null)

  useEffect(() => {
    if (!item.winner_user_id) return
    const supabase = createClient()
    supabase
      .from('profiles')
      .select('id, full_name, email, phone, share_contact_with_vendors')
      .eq('id', item.winner_user_id)
      .single()
      .then(({ data }) => setWinner(data as Profile | null))
  }, [item.winner_user_id])

  return (
    <div className="rounded-lg border p-4 space-y-2">
      <p className="font-semibold">{item.title}</p>
      <p className="text-sm">
        Winning paddle: <span className="font-mono font-bold">#{item.winning_paddle_number}</span>
      </p>
      <p className="text-sm text-muted-foreground">
        Final pool: {formatCredits(item.pool_credits)}
        {item.retail_value_cents != null && (
          <> · Retail {formatCents(item.retail_value_cents)}</>
        )}
      </p>
      {winner && winner.share_contact_with_vendors ? (
        <div className="text-sm bg-green-50 border border-green-200 rounded p-3" role="status">
          <p className="font-medium text-green-900">Winner contact (opt-in)</p>
          <p>{winner.full_name}</p>
          {winner.email && <p>{winner.email}</p>}
          {winner.phone && <p>{winner.phone}</p>}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Winner has not opted in to share contact details with vendors.
        </p>
      )}
    </div>
  )
}
