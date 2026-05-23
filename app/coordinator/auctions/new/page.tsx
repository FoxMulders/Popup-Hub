'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, Gavel, Upload } from 'lucide-react'

function NewAuctionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventId = searchParams.get('eventId')
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [itemName, setItemName] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [timerSeconds, setTimerSeconds] = useState(120)
  const [minDrop, setMinDrop] = useState(25)
  const [maxDrop, setMaxDrop] = useState(100)
  const [saving, setSaving] = useState(false)

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleCreate() {
    if (!title.trim() || !itemName.trim()) {
      toast.error('Title and item name are required')
      return
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let itemImageUrl: string | null = null
      if (imageFile) {
        const path = `auctions/${user.id}/${Date.now()}-item`
        const { error } = await supabase.storage
          .from('auction-assets')
          .upload(path, imageFile, { upsert: true })
        if (!error) {
          const { data } = supabase.storage.from('auction-assets').getPublicUrl(path)
          itemImageUrl = data.publicUrl
        }
      }

      const { data, error } = await supabase
        .from('auctions')
        .insert({
          coordinator_id: user.id,
          event_id: eventId ?? null,
          title: title.trim(),
          item_name: itemName.trim(),
          item_image_url: itemImageUrl,
          timer_duration_seconds: timerSeconds,
          min_drop_amount: minDrop,
          max_drop_amount: maxDrop,
          status: 'upcoming',
        })
        .select('id')
        .single()

      if (error) throw error

      toast.success('Auction created!')
      router.push(`/shared/auction/${data.id}`)
    } catch (err) {
      toast.error('Failed to create auction')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8">
        <h1 className="font-heading text-4xl font-semibold text-foreground">Create Auction</h1>
        <p className="mt-1.5 text-lg text-muted-foreground">
          Set up a digital quarter auction for your event.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-harvest-600" />
            Auction Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Auction Title *</Label>
            <Input
              id="title"
              placeholder="e.g. Riverside Market Quarterly Draw"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-name">Item Being Auctioned *</Label>
            <Input
              id="item-name"
              placeholder="e.g. Handmade Quilt Set"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Item Photo</Label>
            <label className="flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed border-stone-200 p-4 hover:border-forest/40 transition">
              {imagePreview ? (
                <img src={imagePreview} alt="Item" className="h-20 w-20 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Upload className="h-6 w-6 text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-foreground">
                  {imagePreview ? 'Change photo' : 'Upload photo'}
                </p>
                <p className="text-xs text-muted-foreground">JPG, PNG, WebP</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleImage} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="timer">Timer (seconds)</Label>
              <Input
                id="timer"
                type="number"
                min={30}
                max={3600}
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(parseInt(e.target.value) || 60)}
              />
              <p className="text-xs text-muted-foreground">
                {Math.floor(timerSeconds / 60)}m {timerSeconds % 60}s
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-drop">Min Drop (¢)</Label>
              <Input
                id="min-drop"
                type="number"
                min={25}
                step={25}
                value={minDrop}
                onChange={(e) => setMinDrop(parseInt(e.target.value) || 25)}
              />
              <p className="text-xs text-muted-foreground">${(minDrop / 100).toFixed(2)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="max-drop">Max Drop (¢)</Label>
              <Input
                id="max-drop"
                type="number"
                min={minDrop}
                step={25}
                value={maxDrop}
                onChange={(e) => setMaxDrop(parseInt(e.target.value) || 100)}
              />
              <p className="text-xs text-muted-foreground">${(maxDrop / 100).toFixed(2)}</p>
            </div>
          </div>

          <Button
            className="w-full min-h-11 text-base gap-2"
            onClick={handleCreate}
            disabled={saving}
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Gavel className="h-5 w-5" />}
            Create Auction
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function NewAuctionPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>}>
      <NewAuctionForm />
    </Suspense>
  )
}
