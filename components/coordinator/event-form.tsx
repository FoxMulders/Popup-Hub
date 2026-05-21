'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Loader2, MapPin, Calendar, Settings2, Upload, Gavel } from 'lucide-react'
import { CategoryLimitEditor, type CategoryLimit } from './category-limit-editor'
import type { Category, Event } from '@/types/database'

interface EventFormProps {
  categories: Category[]
  coordinatorId: string
  existing?: Event | null
}

export function EventForm({ categories, coordinatorId: userId, existing }: EventFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [locationName, setLocationName] = useState(existing?.location_name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [bookingMode, setBookingMode] = useState<'instant' | 'juried'>(
    existing?.booking_mode ?? 'juried'
  )
  const [status, setStatus] = useState<string>(existing?.status ?? 'draft')
  const [startAt, setStartAt] = useState(
    existing?.start_at ? existing.start_at.slice(0, 16) : ''
  )
  const [endAt, setEndAt] = useState(
    existing?.end_at ? existing.end_at.slice(0, 16) : ''
  )
  const [coverImageUrl, setCoverImageUrl] = useState(existing?.cover_image_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [allowMlm, setAllowMlm] = useState(existing?.allow_mlm ?? false)

  const [lat, setLat] = useState(existing?.latitude ?? 39.5)
  const [lng, setLng] = useState(existing?.longitude ?? -98.35)
  const [pinDropped, setPinDropped] = useState(!!existing?.latitude)

  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>(() => {
    if (!existing) return []
    const limits = (existing as Event & {
      category_limits?: Array<{
        category_id: string
        category?: { name: string }
        max_slots: number
        price_per_booth: number
      }>
    }).category_limits
    return (limits ?? []).map((cl) => ({
      categoryId: cl.category_id,
      categoryName: cl.category?.name ?? '',
      maxSlots: cl.max_slots,
      pricePerBooth: cl.price_per_booth,
    }))
  })

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!e.detail?.latLng) return
    setLat(e.detail.latLng.lat)
    setLng(e.detail.latLng.lng)
    setPinDropped(true)
  }, [])

  async function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverImageUrl(URL.createObjectURL(file))
  }

  async function handleSave(publishStatus?: string) {
    if (!name.trim()) { toast.error('Event name is required'); return }
    if (!startAt || !endAt) { toast.error('Start and end date/time are required'); return }
    if (new Date(endAt) <= new Date(startAt)) { toast.error('End time must be after start time'); return }
    if (!pinDropped) { toast.error('Please drop a map pin for the venue location'); return }

    setSaving(true)
    try {
      let finalCoverUrl = coverImageUrl

      if (coverFile) {
        const path = `events/${userId}/${Date.now()}-cover`
        const { error: uploadError } = await supabase.storage
          .from('event-assets')
          .upload(path, coverFile, { upsert: true })
        if (!uploadError) {
          const { data } = supabase.storage.from('event-assets').getPublicUrl(path)
          finalCoverUrl = data.publicUrl
        }
      }

      const eventPayload = {
        coordinator_id: userId,
        name: name.trim(),
        description: description.trim() || null,
        location_name: locationName.trim(),
        address: address.trim(),
        latitude: lat,
        longitude: lng,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        booking_mode: bookingMode,
        status: publishStatus ?? status,
        cover_image_url: finalCoverUrl || null,
        allow_mlm: allowMlm,
      }

      let eventId = existing?.id

      if (existing) {
        const { error } = await supabase
          .from('events')
          .update(eventPayload)
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('events')
          .insert(eventPayload)
          .select('id')
          .single()
        if (error) throw error
        eventId = data.id
      }

      if (eventId && categoryLimits.length > 0) {
        await supabase.from('event_category_limits').delete().eq('event_id', eventId)
        await supabase.from('event_category_limits').insert(
          categoryLimits.map((cl) => ({
            event_id: eventId,
            category_id: cl.categoryId,
            max_slots: cl.maxSlots,
            price_per_booth: cl.pricePerBooth,
          }))
        )
      }

      toast.success(
        publishStatus === 'published' ? 'Event published! Vendors can now apply.' : 'Event saved.'
      )
      router.push(`/coordinator/events/${eventId}`)
      router.refresh()
    } catch (err) {
      toast.error('Failed to save event. Please try again.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8 items-start">
      {/* Left column */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-amber-500" />
              Event Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Event Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Riverside Weekend Market"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="text-base"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Tell vendors and shoppers what makes this market special…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={800}
              />
              <p className="text-right text-xs text-gray-400">{description.length}/800</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="start">Start Date & Time *</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="end">End Date & Time *</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  min={startAt}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="booking-mode">Booking Mode</Label>
                <Select
                  value={bookingMode}
                  onValueChange={(v) => v !== null && setBookingMode(v as 'instant' | 'juried')}
                >
                  <SelectTrigger id="booking-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">⚡ Instant Book</SelectItem>
                    <SelectItem value="juried">🔍 Juried Approval</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="event-status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(v) => v !== null && setStatus(v)}
                >
                  <SelectTrigger id="event-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="active">Active / Live</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Allow Direct Sales / MLM Vendors</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  When enabled, MLM brands (Scentsy, Norwex, doTERRA, etc.) appear as selectable categories.
                </p>
              </div>
              <Switch
                checked={allowMlm}
                onCheckedChange={setAllowMlm}
                className="ml-4 shrink-0"
              />
            </div>

            <div className="space-y-1">
              <Label>Cover Image</Label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-gray-200 p-4 hover:border-amber-400 transition">
                {coverImageUrl ? (
                  <img src={coverImageUrl} alt="Cover" className="h-16 w-24 rounded-lg object-cover" />
                ) : (
                  <div className="h-16 w-24 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Upload className="h-5 w-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {coverImageUrl ? 'Change cover image' : 'Upload cover image'}
                  </p>
                  <p className="text-xs text-gray-400">JPG, PNG, WebP · Recommended 1200×400</p>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleCoverChange} />
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="h-4 w-4 text-amber-500" />
              Vendor Categories & Booth Caps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryLimitEditor
              categories={categories}
              value={categoryLimits}
              onChange={setCategoryLimits}
              allowMlm={allowMlm}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right column */}
      <div className="space-y-6 xl:sticky xl:top-24">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-amber-500" />
              Venue Location
              {pinDropped && (
                <Badge className="ml-auto bg-green-100 text-green-700 text-xs">Pin dropped</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="loc-name">Venue Name</Label>
                <Input
                  id="loc-name"
                  placeholder="e.g. Riverside Park"
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">Click anywhere on the map to drop your event pin.</p>
            <div className="h-64 rounded-xl overflow-hidden border">
              <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
                <Map
                  mapId="event-form-map"
                  defaultCenter={{ lat, lng }}
                  defaultZoom={pinDropped ? 13 : 4}
                  gestureHandling="greedy"
                  disableDefaultUI
                  onClick={handleMapClick}
                  className="w-full h-full cursor-crosshair"
                >
                  {pinDropped && (
                    <AdvancedMarker position={{ lat, lng }}>
                      <div className="bg-amber-500 text-white rounded-full p-1.5 shadow-lg">
                        <MapPin className="h-4 w-4" />
                      </div>
                    </AdvancedMarker>
                  )}
                </Map>
              </APIProvider>
            </div>
            {pinDropped && (
              <p className="text-xs text-gray-500 font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-100 bg-amber-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-4 w-4 text-amber-500" />
              Publish
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>Booking mode</span>
                <Badge variant="outline" className="capitalize text-xs">
                  {bookingMode === 'instant' ? '⚡ Instant' : '🔍 Juried'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Category slots</span>
                <span className="font-medium">{categoryLimits.length} categories</span>
              </div>
              <div className="flex justify-between">
                <span>Total booth slots</span>
                <span className="font-medium">
                  {categoryLimits.reduce((s, c) => s + c.maxSlots, 0)}
                </span>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={() => handleSave('published')}
                disabled={saving}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Publish Event
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleSave('draft')}
                disabled={saving}
              >
                Save as Draft
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
