'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, Loader2, MapPinned } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { checkCoordinatorPublishGate } from '@/lib/coordinator/publish-gate-client'
import type { LayoutTelemetrySummary } from '@/lib/coordinator/layout-telemetry-summary'
import { applyUnifiedBoothFeeToCategoryLimits } from '@/lib/monetization/booth-pricing'
import { PET_POLICY_LABELS } from '@/lib/shopper/layout'
import {
  CategoryLimitEditor,
  type CategoryLimit,
} from '@/components/coordinator/category-limit-editor'
import { MarketBoothPricingFields } from '@/components/coordinator/wizard/market-booth-pricing-fields'
import { WIZARD_TIME_OPTIONS } from '@/components/coordinator/wizard/wizard-time-options'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MarketPanel, MarketPanelHeader, MarketPanelTitle } from '@/components/ui/market-panel'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Category, Event, EventCategoryLimit, PetPolicy } from '@/types/database'

interface PreFlightReviewClientProps {
  event: Event
  categories: Category[]
  layoutTelemetry: LayoutTelemetrySummary
}

function mapCategoryLimits(
  limits: EventCategoryLimit[],
  boothPriceCents: number
): CategoryLimit[] {
  const mapped = limits.map((cl) => ({
    categoryId: cl.category_id,
    categoryName: cl.category?.name ?? '',
    maxSlots: cl.max_slots,
    pricePerBooth: cl.price_per_booth,
    tableLengthFt: cl.table_length_ft,
  }))
  return applyUnifiedBoothFeeToCategoryLimits(mapped, boothPriceCents)
}

export function PreFlightReviewClient({
  event,
  categories,
  layoutTelemetry,
}: PreFlightReviewClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const isDraft = event.status === 'draft'

  const [name, setName] = useState(event.name)
  const [description, setDescription] = useState(event.description ?? '')
  const [startDate, setStartDate] = useState(event.start_at.slice(0, 10))
  const [startTime, setStartTime] = useState(event.start_at.slice(11, 16))
  const [endDate, setEndDate] = useState(event.end_at.slice(0, 10))
  const [endTime, setEndTime] = useState(event.end_at.slice(11, 16))

  const [parkingNotes, setParkingNotes] = useState(event.parking_notes ?? '')
  const [wheelchairAccessible, setWheelchairAccessible] = useState(
    Boolean(event.wheelchair_access_notes?.trim())
  )
  const [wheelchairNotes, setWheelchairNotes] = useState(event.wheelchair_access_notes ?? '')
  const [petPolicy, setPetPolicy] = useState<PetPolicy>(event.pet_policy ?? 'service_animals_only')

  const [boothPriceCents, setBoothPriceCents] = useState(event.booth_price_cents ?? 0)
  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>(() =>
    mapCategoryLimits(event.category_limits ?? [], event.booth_price_cents ?? 0)
  )

  const [savingLogistics, setSavingLogistics] = useState(false)
  const [savingShopper, setSavingShopper] = useState(false)
  const [savingPricing, setSavingPricing] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const blueprintStudioHref = `/coordinator/dashboard?event=${event.id}`

  const patronSpaceLines = useMemo(() => {
    const { patronSpaces } = layoutTelemetry
    const lines: string[] = []
    if (patronSpaces.guestTables > 0) {
      const parts: string[] = []
      if (patronSpaces.guestRoundTables > 0) {
        parts.push(`${patronSpaces.guestRoundTables} round`)
      }
      if (patronSpaces.guestRectTables > 0) {
        parts.push(`${patronSpaces.guestRectTables} banquet`)
      }
      lines.push(
        `${patronSpaces.guestTables} patron seating table${patronSpaces.guestTables === 1 ? '' : 's'} (${parts.join(', ')})`
      )
    }
    if (patronSpaces.foodTrucks > 0) {
      lines.push(
        `${patronSpaces.foodTrucks} food truck${patronSpaces.foodTrucks === 1 ? '' : 's'}`
      )
    }
    if (patronSpaces.stages > 0) {
      lines.push(`${patronSpaces.stages} stage${patronSpaces.stages === 1 ? '' : 's'}`)
    }
    return lines
  }, [layoutTelemetry])

  async function saveLogistics() {
    setSavingLogistics(true)
    const { error } = await supabase
      .from('events')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        start_at: new Date(`${startDate}T${startTime}`).toISOString(),
        end_at: new Date(`${endDate}T${endTime}`).toISOString(),
      })
      .eq('id', event.id)
    setSavingLogistics(false)
    if (error) {
      toast.error('Could not save event logistics')
      return
    }
    toast.success('Event logistics updated')
    router.refresh()
  }

  async function saveShopperDetails() {
    setSavingShopper(true)
    const { error } = await supabase
      .from('events')
      .update({
        parking_notes: parkingNotes.trim() || null,
        wheelchair_access_notes: wheelchairAccessible ? wheelchairNotes.trim() || null : null,
        pet_policy: petPolicy,
      })
      .eq('id', event.id)
    setSavingShopper(false)
    if (error) {
      toast.error('Could not save shopper details')
      return
    }
    toast.success('Shopper details updated')
    router.refresh()
  }

  async function savePricingCaps() {
    setSavingPricing(true)
    const unifiedLimits = applyUnifiedBoothFeeToCategoryLimits(categoryLimits, boothPriceCents)

    const { error: eventError } = await supabase
      .from('events')
      .update({ booth_price_cents: Math.max(0, boothPriceCents) })
      .eq('id', event.id)

    if (eventError) {
      setSavingPricing(false)
      toast.error('Could not save booth pricing')
      return
    }

    for (const limit of unifiedLimits) {
      const row = (event.category_limits ?? []).find((cl) => cl.category_id === limit.categoryId)
      if (!row?.id) continue
      const { error } = await supabase
        .from('event_category_limits')
        .update({
          max_slots: limit.maxSlots,
          price_per_booth: limit.pricePerBooth,
        })
        .eq('id', row.id)
      if (error) {
        setSavingPricing(false)
        toast.error('Could not save category caps')
        return
      }
    }

    setSavingPricing(false)
    toast.success('Pricing and caps updated')
    router.refresh()
  }

  async function publishMarket() {
    if (!isDraft || publishing) return

    setPublishing(true)
    try {
      const publishBlock = await checkCoordinatorPublishGate()
      if (publishBlock) {
        toast.error(publishBlock)
        return
      }

      const res = await fetch(`/api/coordinator/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Publish failed — try again.')
        return
      }

      await revalidateMarketsCacheClient()
      toast.success('Your market is now live and accepting vendor applications!')
      router.push(`/coordinator/events/${event.id}`)
    } catch {
      toast.error('Publish failed — network error.')
    } finally {
      setPublishing(false)
    }
  }

  function handleBoothPriceChange(cents: number) {
    setBoothPriceCents(cents)
    setCategoryLimits((prev) => applyUnifiedBoothFeeToCategoryLimits(prev, cents))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div>
        <Link
          href={`/coordinator/events/${event.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-forest"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to event overview
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-forest">Pre-Flight Review &amp; Publish</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirm your market details, then publish when the floor plan and caps look right.
        </p>
      </div>

      <MarketPanel className="p-5">
        <MarketPanelHeader>
          <MarketPanelTitle className="flex items-center gap-2 text-forest">
            <MapPinned className="h-4 w-4" aria-hidden />
            Layout snapshot
          </MarketPanelTitle>
        </MarketPanelHeader>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only summary from Blueprint Studio — spatial changes happen only in the canvas.
        </p>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
              Total vendor booths
            </dt>
            <dd className="text-2xl font-bold tabular-nums text-forest">
              {layoutTelemetry.totalBooths}
            </dd>
          </div>
          <div className="rounded-lg border border-stone-200 bg-canvas/60 px-3 py-2">
            <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Rooms
            </dt>
            <dd className="text-sm font-semibold text-foreground">
              {layoutTelemetry.roomCount > 0
                ? layoutTelemetry.roomNames.join(' · ')
                : 'No rooms saved yet'}
            </dd>
          </div>
        </dl>

        {layoutTelemetry.categories.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Booth categories on canvas
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {layoutTelemetry.categories.map((row) => (
                <li key={row.name} className="flex justify-between gap-3">
                  <span>{row.name}</span>
                  <span className="font-semibold tabular-nums text-forest">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No vendor booths placed yet — open Blueprint Studio to place booths before publishing.
          </p>
        )}

        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Configured patron spaces
          </p>
          {patronSpaceLines.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {patronSpaceLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No patron seating or amenities placed.</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {layoutTelemetry.patronSpaces.total} patron element
            {layoutTelemetry.patronSpaces.total === 1 ? '' : 's'} total
          </p>
        </div>

        <Link
          href={blueprintStudioHref}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Return to Blueprint Studio to change layout
        </Link>
      </MarketPanel>

      <MarketPanel className="p-5 space-y-4">
        <div>
          <MarketPanelTitle className="text-forest">Event logistics</MarketPanelTitle>
          <p className="text-sm text-muted-foreground">
            Market title, schedule window, and public description.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-market-title">Market title</Label>
          <Input id="review-market-title" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-description">Description</Label>
          <Textarea
            id="review-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="review-start-date">Start date</Label>
            <Input
              id="review-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Start time</Label>
            <Select
              value={startTime}
              onValueChange={(v) => {
                if (v) setStartTime(v)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIZARD_TIME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="review-end-date">End date</Label>
            <Input
              id="review-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>End time</Label>
            <Select
              value={endTime}
              onValueChange={(v) => {
                if (v) setEndTime(v)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WIZARD_TIME_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(new Date(`${startDate}T${startTime}`), 'EEE, MMM d · h:mm a')} —{' '}
          {format(new Date(`${endDate}T${endTime}`), 'EEE, MMM d · h:mm a')}
        </p>
        <Button type="button" onClick={saveLogistics} disabled={savingLogistics}>
          {savingLogistics ? 'Saving…' : 'Save logistics'}
        </Button>
      </MarketPanel>

      <MarketPanel className="p-5 space-y-4">
        <div>
          <MarketPanelTitle className="text-forest">Shopper details</MarketPanelTitle>
          <p className="text-sm text-muted-foreground">
            Parking, accessibility, and pet policies shown on the public listing.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="review-parking">Parking notes</Label>
          <Textarea
            id="review-parking"
            value={parkingNotes}
            onChange={(e) => setParkingNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Free lot behind the hall…"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-canvas/50 px-3 py-2">
          <div>
            <p className="text-sm font-medium">Wheelchair accessible</p>
            <p className="text-xs text-muted-foreground">
              Toggle on when patrons can navigate the venue with mobility aids.
            </p>
          </div>
          <Switch
            checked={wheelchairAccessible}
            onCheckedChange={(checked) => {
              setWheelchairAccessible(checked)
              if (!checked) setWheelchairNotes('')
            }}
            aria-label="Wheelchair accessible"
          />
        </div>
        {wheelchairAccessible ? (
          <div className="space-y-1.5">
            <Label htmlFor="review-wheelchair">Accessibility notes</Label>
            <Textarea
              id="review-wheelchair"
              value={wheelchairNotes}
              onChange={(e) => setWheelchairNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Ramp at main entrance…"
            />
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>Pet policy</Label>
          <Select value={petPolicy} onValueChange={(v) => setPetPolicy(v as PetPolicy)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PET_POLICY_LABELS) as PetPolicy[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PET_POLICY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={saveShopperDetails} disabled={savingShopper}>
          {savingShopper ? 'Saving…' : 'Save shopper details'}
        </Button>
      </MarketPanel>

      <MarketPanel className="p-5 space-y-4">
        <div>
          <MarketPanelTitle className="text-forest">Pricing &amp; caps</MarketPanelTitle>
          <p className="text-sm text-muted-foreground">
            Booth rental pricing and per-category waitlist caps before vendors apply.
          </p>
        </div>
        <MarketBoothPricingFields
          boothPriceCents={boothPriceCents}
          onBoothPriceCentsChange={handleBoothPriceChange}
          compact
        />
        <CategoryLimitEditor
          categories={categories}
          value={categoryLimits}
          onChange={(limits) =>
            setCategoryLimits(applyUnifiedBoothFeeToCategoryLimits(limits, boothPriceCents))
          }
          unifiedBoothFeeCents={boothPriceCents}
          grouped={false}
        />
        <Button type="button" onClick={savePricingCaps} disabled={savingPricing}>
          {savingPricing ? 'Saving…' : 'Save pricing & caps'}
        </Button>
      </MarketPanel>

      <div className="rounded-xl border-2 border-forest bg-forest/5 p-5">
        <p className="text-sm font-medium text-forest">
          {isDraft
            ? 'Ready to open vendor applications?'
            : 'This market is already published.'}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Publishing makes your listing discoverable and lets vendors apply for booths.
        </p>
        <Button
          type="button"
          size="lg"
          className={cn(
            'mt-4 w-full gap-2 border-2 border-forest bg-forest text-white shadow-lg shadow-forest/25 hover:bg-forest/90',
            (!isDraft || publishing) && 'pointer-events-none opacity-60'
          )}
          disabled={!isDraft || publishing}
          onClick={() => void publishMarket()}
        >
          {publishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Publishing…
            </>
          ) : (
            '🚀 Publish Market'
          )}
        </Button>
      </div>
    </div>
  )
}
