'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Map,
  AdvancedMarker,
  type MapMouseEvent,
  useApiIsLoaded,
} from '@vis.gl/react-google-maps'
import { GoogleMapsProvider } from '@/components/map/google-maps-provider'
import { GoogleMapsApiFallback } from '@/components/map/google-maps-api-fallback'
import { MapRecenter } from '@/components/map/map-recenter'
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
import { toast } from '@/lib/toast'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Loader2, MapPin, Calendar, Settings2, Upload, Gavel, Trash2, HelpCircle } from 'lucide-react'
import { buildNextEventDayRow } from '@/lib/events/event-day-rows'
import { ScheduleWeekendShortcuts } from '@/components/shared/schedule-weekend-shortcuts'
import { FlyerCoverUpload } from '@/components/coordinator/flyer-cover-upload'
import { BoothContractEditor } from '@/components/coordinator/booth-contract-editor'
import { enabledContractClausesForStorage } from '@/lib/booth-contract/resolve-event-contract'
import { normalizeEventContractClauses } from '@/lib/legal/booth-contract-templates'
import { FlyerFieldHighlight } from '@/components/coordinator/flyer-field-highlight'
import { useFlyerScan } from '@/hooks/use-flyer-scan'
import { DeleteDraftMarketDialog } from '@/components/coordinator/delete-draft-market-dialog'
import { CategoryLimitEditor, type CategoryLimit } from './category-limit-editor'
import { MarketBoothPricingFields } from '@/components/coordinator/wizard/market-booth-pricing-fields'
import { applyUnifiedBoothFeeToCategoryLimits } from '@/lib/monetization/booth-pricing'
import { SmartPopulateBoothCaps } from './smart-populate-booth-caps'
import {
  isCommunityLeagueVenueName,
  shouldSubmitPlatformVenue,
  submitPlatformVenue,
  alertAdminsOfVenueSubmission,
} from '@/lib/venues/platform-venue-submissions'
import { EdmontonHallSelector } from './edmonton-hall-selector'
import { getEdmontonHallById } from '@/lib/data/edmonton-halls'
import type { EdmontonHall } from '@/lib/data/edmonton-halls'
import { CLEARANCE_POLICY_OPTIONS } from '@/lib/booth-clearance-policy'
import { sortCategoriesByName } from '@/lib/categories'
import { selectValueOrNull } from '@/lib/wizard/wizard-autosave'
import {
  formatUnknownSaveError,
  isPostgrestSchemaCacheError,
} from '@/lib/supabase/postgrest-errors'
import { WIZARD_DRAFT_BADGE } from '@/lib/wizard/wizard-panel-styles'
import { marketStatusBadge, marketTheme } from '@/lib/theme/market'
import { cn } from '@/lib/utils'
import { usePlacesApiStatus } from '@/components/coordinator/floor-plan-v2/debug/places-api-status-context'
import {
  fetchPlaceDetailsSafe,
  usePlacesAutocomplete,
} from '@/hooks/use-places-autocomplete'
import type { BoothClearancePolicy, Category, Event, EventDay } from '@/types/database'

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts = []
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) break
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const period = h < 12 ? 'AM' : 'PM'
      const displayH = h % 12 === 0 ? 12 : h % 12
      opts.push({ value: `${hh}:${mm}`, label: `${displayH}:${mm} ${period}` })
    }
  }
  return opts
})()

interface DayRow {
  date: string
  start_time: string
  end_time: string
}

function formatShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface EventFormProps {
  categories: Category[]
  coordinatorId: string
  existing?: Event | null
}

export function EventForm({ categories, coordinatorId: userId, existing }: EventFormProps) {
  const sortedCategories = sortCategoriesByName(categories)
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)

  const [scheduleType, setScheduleType] = useState<'single' | 'multi'>(
    existing?.is_multi_day ? 'multi' : 'single'
  )

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [locationName, setLocationName] = useState(existing?.location_name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [bookingMode, setBookingMode] = useState<'instant' | 'juried'>(
    existing?.booking_mode ?? 'juried'
  )
  const [status] = useState<string>(existing?.status ?? 'draft')
  const [startDate, setStartDate] = useState(
    existing?.start_at ? existing.start_at.slice(0, 10) : ''
  )
  const [startTime, setStartTime] = useState(
    existing?.start_at ? existing.start_at.slice(11, 16) : ''
  )
  const [endDate, setEndDate] = useState(
    existing?.end_at ? existing.end_at.slice(0, 10) : ''
  )
  const [endTime, setEndTime] = useState(
    existing?.end_at ? existing.end_at.slice(11, 16) : ''
  )
  const [coverImageUrl, setCoverImageUrl] = useState(existing?.cover_image_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const { parsing: parsingFlyer, autoFilledFields, scanFlyer } = useFlyerScan()
  const [allowMlm, setAllowMlm] = useState(existing?.allow_mlm ?? false)
  const [boothClearancePolicy, setBoothClearancePolicy] = useState<BoothClearancePolicy>(
    existing?.booth_clearance_policy ?? 'leave_furniture'
  )
  const [raffleDonationRequirement, setRaffleDonationRequirement] = useState(
    existing?.raffle_donation_requirement ?? ''
  )
  const [boothContractEnabled, setBoothContractEnabled] = useState(
    existing?.booth_contract_enabled ?? true
  )
  const [boothContractClauses, setBoothContractClauses] = useState(() =>
    normalizeEventContractClauses(existing?.booth_contract_clauses, {
      requireFullAttendance: existing?.require_full_attendance ?? true,
      marketInsuranceRequired: existing?.market_insurance_required ?? false,
      boothClearancePolicy: existing?.booth_clearance_policy ?? 'leave_furniture',
      eventName: existing?.name,
    })
  )
  const [boothContractPdfUrl, setBoothContractPdfUrl] = useState<string | null>(
    existing?.booth_contract_pdf_url ?? null
  )
  const [boothContractReviewed, setBoothContractReviewed] = useState(
    Boolean(existing?.booth_contract_updated_at)
  )
  const [marketInsuranceRequired, setMarketInsuranceRequired] = useState(
    existing?.market_insurance_required ?? false
  )

  const [dayRows, setDayRows] = useState<DayRow[]>(() => {
    if (existing?.event_days && existing.event_days.length > 0) {
      return [...existing.event_days]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((d: EventDay) => ({ date: d.date, start_time: d.start_time, end_time: d.end_time }))
    }
    return [{ date: '', start_time: '', end_time: '' }]
  })

  const [lat, setLat] = useState(existing?.latitude ?? 53.5461)
  const [lng, setLng] = useState(existing?.longitude ?? -113.4938)
  const [pinDropped, setPinDropped] = useState(!!existing?.latitude)

  useEffect(() => {
    if (!existing?.id) return
    let cancelled = false
    void (async () => {
      const { data } = await supabase
        .from('booth_layouts')
        .select('venue_width, venue_length')
        .eq('event_id', existing.id)
        .maybeSingle()
      if (cancelled || !data) return
      if (data.venue_width) setPlannerVenueWidth(data.venue_width as number)
      if (data.venue_length) setPlannerVenueLength(data.venue_length as number)
    })()
    return () => {
      cancelled = true
    }
  }, [existing?.id, supabase])

  const [plannerVenueWidth, setPlannerVenueWidth] = useState(100)
  const [plannerVenueLength, setPlannerVenueLength] = useState(100)

  const [boothPriceCents, setBoothPriceCents] = useState(() => {
    const fromEvent = existing?.booth_price_cents
    if (fromEvent != null && fromEvent > 0) return fromEvent
    const limits = (
      existing as Event & {
        category_limits?: Array<{ price_per_booth: number }>
      }
    )?.category_limits
    return limits?.find((cl) => cl.price_per_booth > 0)?.price_per_booth ?? 0
  })

  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>(() => {
    if (!existing) return []
    const limits = (existing as Event & {
      category_limits?: Array<{
        category_id: string
        category?: { name: string }
        max_slots: number
        price_per_booth: number
        table_length_ft: number | null
      }>
    }).category_limits
    const nameById = Object.fromEntries(categories.map((c) => [c.id, c.name])) as Record<string, string>
    const mapped = (limits ?? []).map((cl) => ({
      categoryId: cl.category_id,
      categoryName: cl.category?.name?.trim() || nameById[cl.category_id] || '',
      maxSlots: cl.max_slots,
      pricePerBooth: cl.price_per_booth,
      tableLengthFt: cl.table_length_ft ?? null,
    }))
    return applyUnifiedBoothFeeToCategoryLimits(mapped, boothPriceCents)
  })
  const [multiTableDiscountPercent, setMultiTableDiscountPercent] = useState(
    existing?.multi_table_discount_percent ?? 0
  )
  const [communityLeagueDiscountEnabled, setCommunityLeagueDiscountEnabled] = useState(
    existing?.community_league_discount_enabled ?? false
  )
  const [communityLeagueDiscountPercent, setCommunityLeagueDiscountPercent] = useState(
    existing?.community_league_discount_percent ?? 0
  )
  const [passFeesToVendor, setPassFeesToVendor] = useState(existing?.pass_fees_to_vendor ?? false)

  useEffect(() => {
    if (isCommunityLeagueVenueName(locationName) && !communityLeagueDiscountEnabled) {
      setCommunityLeagueDiscountEnabled(true)
      if (communityLeagueDiscountPercent <= 0) setCommunityLeagueDiscountPercent(10)
    }
  }, [locationName, communityLeagueDiscountEnabled, communityLeagueDiscountPercent])

  function handleBoothPriceCentsChange(cents: number) {
    setBoothPriceCents(cents)
    setCategoryLimits((prev) => applyUnifiedBoothFeeToCategoryLimits(prev, cents))
  }

  function handleCategoryLimitsChange(limits: CategoryLimit[]) {
    setCategoryLimits(applyUnifiedBoothFeeToCategoryLimits(limits, boothPriceCents))
  }

  const handleMapClick = useCallback((e: MapMouseEvent) => {
    if (!e.detail?.latLng) return
    setLat(e.detail.latLng.lat)
    setLng(e.detail.latLng.lng)
    setPinDropped(true)
  }, [])

  function handleHallSelect(hall: EdmontonHall | null) {
    if (!hall) return
    const full = getEdmontonHallById(hall.id)
    if (!full) return
    setLocationName(full.name)
    setAddress(full.location)
    setLat(full.latitude)
    setLng(full.longitude)
    setPinDropped(true)
    setPlannerVenueWidth(full.widthFt)
    setPlannerVenueLength(full.lengthFt)
  }

  async function handleCoverFileSelected(file: File) {
    setCoverFile(file)
    setCoverImageUrl(URL.createObjectURL(file))
    await scanFlyer(file, {
      setEventName: setName,
      setDescription,
      setScheduleType,
      setDayRows,
      setStartDate,
      setEndDate,
      setStartTime,
      setEndTime,
      setLocationName,
      setAddress,
      setRaffleDonationRequirement,
    })
  }

  function updateDayRow(index: number, field: keyof DayRow, value: string) {
    setDayRows((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  function addDayRow() {
    setDayRows((prev) => [...prev, buildNextEventDayRow(prev)])
  }

  function removeDayRow(index: number) {
    setDayRows((prev) => prev.filter((_, i) => i !== index))
  }

  function sortedDayRows(): DayRow[] {
    return [...dayRows].sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }

  async function handleSave(publishStatus?: string) {
    if (!name.trim()) { toast.error('Event name is required'); return }
    if (!pinDropped) { toast.error('Please drop a map pin for the venue location'); return }

    if (publishStatus === 'published') {
      if (categoryLimits.length === 0) {
        toast.error(
          'Add at least one booth category before publishing.'
        )
        return
      }
      if (!Number.isFinite(boothPriceCents) || boothPriceCents < 0) {
        toast.error('Set a valid booth fee before publishing. Use $0 for free booths.')
        return
      }
    }

    const hasPaidBooths = boothPriceCents > 0
    if (publishStatus === 'published') {
      try {
        const verifyRes = await fetch('/api/coordinator/venues/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: existing?.id,
            latitude: lat,
            longitude: lng,
            address,
            locationName,
            pinDropped,
            persist: Boolean(existing?.id),
          }),
        })
        const verifyData = await verifyRes.json()
        if (!verifyRes.ok || !verifyData.verified) {
          toast.error(
            verifyData.reason ??
              'Venue must be verified on the map with a complete address before publishing.'
          )
          return
        }
      } catch {
        toast.error('Could not verify venue location before publishing.')
        return
      }
    }

    if (publishStatus === 'published' && hasPaidBooths) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('payout_onboarding_status, payout_account_id')
        .eq('id', userId)
        .single()

      const squareReady =
        profile?.payout_onboarding_status === 'complete' && !!profile.payout_account_id

      if (!squareReady) {
        toast.error('Connect Square before publishing an event with paid booth fees.')
        return
      }
    }

    let startAt: string
    let endAt: string

    if (scheduleType === 'multi') {
      const filledRows = dayRows.filter((r) => r.date && r.start_time && r.end_time)
      if (filledRows.length === 0) {
        toast.error('Add at least one complete day with date, start time, and end time')
        return
      }
      if (dayRows.some((r) => !r.date || !r.start_time || !r.end_time)) {
        toast.error('All day rows must have a date, start time, and end time filled in')
        return
      }
      const sorted = sortedDayRows()
      startAt = new Date(`${sorted[0].date}T${sorted[0].start_time}`).toISOString()
      endAt = new Date(`${sorted[sorted.length - 1].date}T${sorted[sorted.length - 1].end_time}`).toISOString()
    } else {
      if (!startDate || !startTime || !endDate || !endTime) {
        toast.error('Start and end date/time are required')
        return
      }
      if (new Date(`${endDate}T${endTime}`) <= new Date(`${startDate}T${startTime}`)) {
        toast.error('End time must be after start time')
        return
      }
      startAt = new Date(`${startDate}T${startTime}`).toISOString()
      endAt = new Date(`${endDate}T${endTime}`).toISOString()
    }

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
        start_at: startAt,
        end_at: endAt,
        booking_mode: bookingMode,
        status: publishStatus ?? status,
        cover_image_url: finalCoverUrl || null,
        allow_mlm: allowMlm,
        is_multi_day: scheduleType === 'multi',
        booth_clearance_policy: boothClearancePolicy,
        raffle_donation_requirement: raffleDonationRequirement.trim() || null,
        market_insurance_required: marketInsuranceRequired,
        booth_price_cents: Math.max(0, boothPriceCents),
        multi_table_discount_percent: Math.min(
          100,
          Math.max(0, Math.round(multiTableDiscountPercent))
        ),
        community_league_discount_enabled: communityLeagueDiscountEnabled,
        community_league_discount_percent: Math.min(
          100,
          Math.max(0, Math.round(communityLeagueDiscountPercent))
        ),
        pass_fees_to_vendor: passFeesToVendor,
        booth_contract_enabled: boothContractEnabled,
        booth_contract_clauses: enabledContractClausesForStorage(boothContractClauses),
        booth_contract_pdf_url: boothContractPdfUrl,
        booth_contract_updated_at: boothContractReviewed
          ? existing?.booth_contract_updated_at ?? new Date().toISOString()
          : existing?.booth_contract_updated_at ?? null,
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
            table_length_ft: cl.tableLengthFt ?? null,
          }))
        )
      }

      if (eventId && scheduleType === 'multi') {
        await supabase.from('event_days').delete().eq('event_id', eventId)
        const sorted = sortedDayRows()
        await supabase.from('event_days').insert(
          sorted.map((row, i) => ({
            event_id: eventId,
            date: row.date,
            start_time: row.start_time,
            end_time: row.end_time,
            sort_order: i,
          }))
        )
      } else if (eventId) {
        await supabase.from('event_days').delete().eq('event_id', eventId)
      }

      if (
        eventId &&
        pinDropped &&
        locationName.trim() &&
        address.trim()
      ) {
        const shouldSubmit = await shouldSubmitPlatformVenue(supabase, userId, {
          locationName,
          address,
          latitude: lat,
          longitude: lng,
        })
        if (shouldSubmit) {
          const { created, error: submitError, submissionId } = await submitPlatformVenue(supabase, userId, {
            locationName,
            address,
            latitude: lat,
            longitude: lng,
          })
          if (submitError) {
            toast.error(submitError.message)
          } else if (created) {
            toast.message('New venue submitted for admin review')
            if (submissionId) void alertAdminsOfVenueSubmission(submissionId)
          }
        }
      }

      toast.success(
        publishStatus === 'published' ? 'Event published! Vendors can now apply.' : 'Event saved.'
      )
      const savedStatus = publishStatus ?? status
      if (['published', 'active'].includes(savedStatus)) {
        await revalidateMarketsCacheClient()
      }
      router.push(`/coordinator/events/${eventId}`)
      router.refresh()
    } catch (err) {
      const detail = formatUnknownSaveError(err)
      toast.error(
        isPostgrestSchemaCacheError(
          err && typeof err === 'object' ? (err as { code?: string; message?: string }) : {}
        )
          ? detail
          : 'Failed to save event. Please try again.'
      )
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const multiDaySummary = (() => {
    if (scheduleType !== 'multi') return null
    const filled = dayRows.filter((r) => r.date)
    if (filled.length === 0) return null
    const sorted = [...filled].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length === 1) return { count: 1, range: formatShortDate(sorted[0].date) }
    return {
      count: sorted.length,
      range: `${formatShortDate(sorted[0].date)} – ${formatShortDate(sorted[sorted.length - 1].date)}`,
    }
  })()

  return (
    <GoogleMapsProvider
      apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}
      libraries={['places']}
      fallback={<GoogleMapsApiFallback />}
    >
    <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-8 items-start">
      {/* Left column */}
      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-forest" />
                Event Details
              </CardTitle>
              {existing?.status === 'draft' && existing.id ? (
                <DeleteDraftMarketDialog eventId={existing.id} eventName={name} />
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="relative space-y-4">
            {parsingFlyer ? (
              <div
                className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-cream/75 backdrop-blur-[2px]"
                aria-hidden
              >
                <div className="mx-4 max-w-sm rounded-xl border border-harvest-200 bg-white px-5 py-4 text-center shadow-lg">
                  <p className="text-sm font-semibold text-harvest-800">✨ AI is reading your poster details…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We&apos;ll fill matching fields when ready. Review everything before saving.
                  </p>
                </div>
              </div>
            ) : null}

            <FlyerCoverUpload
              coverImageUrl={coverImageUrl}
              onFileSelected={handleCoverFileSelected}
              parsing={parsingFlyer}
              label="Cover Image / Flyer"
              hint="JPG, PNG, WebP · 1200×400 recommended · AI reads flyer details"
            />

            <FlyerFieldHighlight fieldKey="name" autoFilledFields={autoFilledFields}>
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
            </FlyerFieldHighlight>

            {/* Schedule Type segmented control */}
            <div className="space-y-1">
              <Label>Schedule Type</Label>
              <div className={cn(marketTheme.segmentTrack, 'p-1 gap-1')}>
                <button
                  type="button"
                  onClick={() => setScheduleType('single')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium min-h-11',
                    scheduleType === 'single' ? marketTheme.segmentActive : marketTheme.segmentIdle
                  )}
                >
                  Single Day
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleType('multi')}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium min-h-11',
                    scheduleType === 'multi' ? marketTheme.segmentActive : marketTheme.segmentIdle
                  )}
                >
                  Multi-Day
                </button>
              </div>
              <ScheduleWeekendShortcuts
                scheduleType={scheduleType}
                onApply={(range) => {
                  if (scheduleType === 'multi') {
                    setDayRows([
                      { date: range.startDate, start_time: '09:00', end_time: '17:00' },
                      { date: range.endDate, start_time: '09:00', end_time: '17:00' },
                    ])
                  } else {
                    setStartDate(range.startDate)
                    setEndDate(range.startDate)
                  }
                }}
              />
            </div>

            <FlyerFieldHighlight fieldKey="description" autoFilledFields={autoFilledFields}>
              <div className="space-y-1">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell vendors and shoppers what makes this market special…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={2000}
                />
                <p className="text-right text-xs text-muted-foreground">{description.length}/2000</p>
              </div>
            </FlyerFieldHighlight>

            {scheduleType === 'single' ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="start-date">Start Date & Time *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <Select value={startTime} onValueChange={(v) => { const next = selectValueOrNull(v); if (next) setStartTime(next) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="end-date">End Date & Time *</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                  <Select value={endTime} onValueChange={(v) => { const next = selectValueOrNull(v); if (next) setEndTime(next) }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Market Days *</Label>
                {dayRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateDayRow(i, 'date', e.target.value)}
                      className="w-40 shrink-0"
                    />
                    <Select
                      value={row.start_time}
                      onValueChange={(v) => { const next = selectValueOrNull(v); if (next) updateDayRow(i, 'start_time', next) }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="Start time" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground text-sm shrink-0">to</span>
                    <Select
                      value={row.end_time}
                      onValueChange={(v) => { const next = selectValueOrNull(v); if (next) updateDayRow(i, 'end_time', next) }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue placeholder="End time" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {dayRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeDayRow(i)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        aria-label="Remove day"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addDayRow}
                  className="w-full rounded-lg border-2 border-dashed border-stone-200 py-2 text-sm text-muted-foreground hover:border-forest/50 hover:text-forest transition-colors"
                >
                  + Add Another Day
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="booking-mode">Booking Mode</Label>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p><strong>Instant Book</strong> — vendors are approved automatically the moment they apply. Best for open, low-curation markets.</p>
                      <p className="mt-1"><strong>Juried Approval</strong> — you manually review and approve or reject each application. Best for curated markets where you control the vendor mix.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={bookingMode}
                  onValueChange={(v) => { const next = selectValueOrNull(v); if (next === 'instant' || next === 'juried') setBookingMode(next) }}
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
                <Label>Status</Label>
                <span className={WIZARD_DRAFT_BADGE}>Draft</span>
                <p className="text-xs text-muted-foreground">
                  Publish from the setup wizard floor plan step when your layout is ready.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground">Allow direct sales vendors</p>
                  <Tooltip>
                    <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      When enabled, catalog and party-plan companies (Scentsy, Norwex, doTERRA, etc.) can be
                      offered at this market. You control how many booths they get in the capacity step.
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  When enabled, direct-sales categories appear in the booth limit editor.
                </p>
              </div>
              <Switch
                checked={allowMlm}
                onCheckedChange={setAllowMlm}
                className="ml-4 shrink-0"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="clearance-policy-form">Clean up and/or tear down</Label>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Choose whether vendors must submit a photo when leaving, and whether venue tables and chairs stay in place or must be packed away.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={boothClearancePolicy}
                onValueChange={(v) => { const next = selectValueOrNull(v); if (next) setBoothClearancePolicy(next as BoothClearancePolicy) }}
              >
                <SelectTrigger id="clearance-policy-form">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLEARANCE_POLICY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {CLEARANCE_POLICY_OPTIONS.find((o) => o.value === boothClearancePolicy)?.description}
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="raffle-requirement">Raffle donation requirement (optional)</Label>
              <Textarea
                id="raffle-requirement"
                placeholder="e.g. One handmade item valued at $25+ for the door prize table"
                value={raffleDonationRequirement}
                onChange={(e) => setRaffleDonationRequirement(e.target.value)}
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Shown on the market-day operations grid while coordinators track raffle drop-offs.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-xl border border-stone-200 bg-canvas px-4 py-3">
              <div className="space-y-1">
                <Label htmlFor="market-insurance-required">Require Market Insurance from Vendors?</Label>
                <p className="text-xs text-muted-foreground">
                  Approved vendors must upload proof of insurance before their booth is finalized.
                </p>
              </div>
              <Switch
                id="market-insurance-required"
                checked={marketInsuranceRequired}
                onCheckedChange={setMarketInsuranceRequired}
              />
            </div>

            <div id="booth-contract" className="scroll-mt-24">
              <BoothContractEditor
              eventId={existing?.id ?? null}
              coordinatorId={userId}
              eventName={name}
              enabled={boothContractEnabled}
              onEnabledChange={setBoothContractEnabled}
              clauses={boothContractClauses}
              onClausesChange={setBoothContractClauses}
              pdfUrl={boothContractPdfUrl}
              onPdfUrlChange={setBoothContractPdfUrl}
              requireFullAttendance={existing?.require_full_attendance ?? true}
              marketInsuranceRequired={marketInsuranceRequired}
              boothClearancePolicy={boothClearancePolicy}
              contractReviewed={boothContractReviewed}
              onContractReviewedChange={setBoothContractReviewed}
              onSaved={() => router.refresh()}
            />
            </div>
          </CardContent>
        </Card>

        <Card id="categories" className="scroll-mt-24">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-heading">
              <Settings2 className="h-4 w-4 text-forest" />
              Vendor Categories & Booth Caps
              <Tooltip>
                <TooltipTrigger type="button" className="ml-1"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Add categories to control how many vendors of each type can attend and what they pay for a booth. Vendors will only see categories you add here when applying.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MarketBoothPricingFields
              boothPriceCents={boothPriceCents}
              onBoothPriceCentsChange={handleBoothPriceCentsChange}
              multiTableDiscountPercent={multiTableDiscountPercent}
              onMultiTableDiscountPercentChange={setMultiTableDiscountPercent}
              communityLeagueDiscountEnabled={communityLeagueDiscountEnabled}
              onCommunityLeagueDiscountEnabledChange={setCommunityLeagueDiscountEnabled}
              communityLeagueDiscountPercent={communityLeagueDiscountPercent}
              onCommunityLeagueDiscountPercentChange={setCommunityLeagueDiscountPercent}
              suggestCommunityLeagueDiscount={isCommunityLeagueVenueName(locationName)}
              passFeesToVendor={passFeesToVendor}
              onPassFeesToVendorChange={setPassFeesToVendor}
            />
            <SmartPopulateBoothCaps
              categories={sortedCategories}
              allowMlm={allowMlm}
              venueWidthFt={plannerVenueWidth}
              venueLengthFt={plannerVenueLength}
              onVenueWidthChange={setPlannerVenueWidth}
              onVenueLengthChange={setPlannerVenueLength}
              existingLimits={categoryLimits}
              onPopulate={handleCategoryLimitsChange}
            />
            <CategoryLimitEditor
              categories={sortedCategories}
              value={categoryLimits}
              onChange={handleCategoryLimitsChange}
              allowMlm={allowMlm}
              unifiedBoothFeeCents={boothPriceCents}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right column */}
      <div className="space-y-6 xl:sticky xl:top-24">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-forest" />
              Venue Location
              {pinDropped && (
                <Badge className={`ml-auto ${marketStatusBadge.success} text-xs`}>Pin dropped</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <EdmontonHallSelector onHallSelect={handleHallSelect} />
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="loc-name">Venue Name</Label>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent>The display name shown to shoppers and vendors (e.g. "Riverside Park" or "Edmonton Expo Centre").</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="loc-name"
                placeholder="e.g. Riverside Park"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="address">Address</Label>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent>Start typing to search. Selecting an address will automatically drop the map pin.</TooltipContent>
                </Tooltip>
              </div>
              <AddressAutocomplete
                value={address}
                onChange={setAddress}
                onPlaceSelect={(place) => {
                  setAddress(place.address)
                  setLat(place.lat)
                  setLng(place.lng)
                  setPinDropped(true)
                  if (!locationName) setLocationName(place.name)
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Or click anywhere on the map to drop your event pin.</p>
            <div className="h-64 overflow-hidden rounded-xl border [touch-action:auto]">
                <Map
                  mapId="event-form-map"
                  defaultCenter={{ lat, lng }}
                  defaultZoom={pinDropped ? 13 : 11}
                  gestureHandling="greedy"
                  disableDefaultUI
                  onClick={handleMapClick}
                  className="h-full w-full cursor-crosshair"
                >
                  <MapRecenter lat={lat} lng={lng} pinDropped={pinDropped} zoomOnPinDrop zoom={13} />
                  {pinDropped && (
                    <AdvancedMarker position={{ lat, lng }}>
                      <div className="bg-forest text-primary-foreground rounded-full p-1.5 shadow-[var(--shadow-market-lift)]">
                        <MapPin className="h-4 w-4" />
                      </div>
                    </AdvancedMarker>
                  )}
                </Map>
            </div>
            {pinDropped && (
              <p className="text-xs text-muted-foreground font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-harvest-200 bg-harvest-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="h-4 w-4 text-harvest-600" />
              Publish
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Booking mode</span>
                <Badge variant="outline" className="capitalize text-xs">
                  {bookingMode === 'instant' ? '⚡ Instant' : '🔍 Juried'}
                </Badge>
              </div>
              {scheduleType === 'single' ? (
                startDate && (
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span className="font-medium">
                      {formatShortDate(startDate)}
                      {endDate && endDate !== startDate ? ` – ${formatShortDate(endDate)}` : ''}
                    </span>
                  </div>
                )
              ) : (
                multiDaySummary && (
                  <div className="flex justify-between">
                    <span>Schedule</span>
                    <span className="font-medium">
                      {multiDaySummary.count} Market {multiDaySummary.count === 1 ? 'Day' : 'Days'} · {multiDaySummary.range}
                    </span>
                  </div>
                )
              )}
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
                className={cn('w-full min-h-11', marketTheme.cta)}
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
    </GoogleMapsProvider>
  )
}

// ── Address Autocomplete ──────────────────────────────────────────────────────
interface PlaceResult {
  address: string
  lat: number
  lng: number
  name: string
}

function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
}: {
  value: string
  onChange: (v: string) => void
  onPlaceSelect: (place: PlaceResult) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { reportPlacesApi } = usePlacesApiStatus()
  const {
    predictions,
    open,
    setOpen,
    apiUnavailable,
    clearPredictions,
  } = usePlacesAutocomplete({
    input: value,
    buildRequest: () => ({
      input: value,
      componentRestrictions: { country: ['ca', 'us'] },
    }),
    onApiStatus: reportPlacesApi,
  })

  async function selectPrediction(
    prediction: google.maps.places.AutocompletePrediction
  ) {
    setOpen(false)
    clearPredictions()
    onChange(prediction.description)

    const place = await fetchPlaceDetailsSafe(prediction.place_id, [
      'formatted_address',
      'geometry',
      'name',
    ])
    if (place?.geometry?.location) {
      onPlaceSelect({
        address: place.formatted_address ?? prediction.description,
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        name: place.name ?? '',
      })
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <Input
        id="address"
        placeholder={
          apiUnavailable
            ? 'Enter address manually (suggestions unavailable)'
            : 'Start typing an address…'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        className="text-foreground"
      />
      {apiUnavailable ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Address suggestions are unavailable — type the full address manually.
        </p>
      ) : null}
      {open && predictions.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-lg border-2 border-stone-200 bg-card shadow-[var(--shadow-market)] overflow-hidden">
          {predictions.map((p) => (
            <li
              key={p.place_id}
              className="cursor-pointer px-4 py-2.5 text-sm text-foreground hover:bg-sage-50 hover:text-forest border-b last:border-0"
              onMouseDown={(e) => { e.preventDefault(); selectPrediction(p) }}
            >
              <span className="font-medium">{p.structured_formatting.main_text}</span>
              <span className="text-muted-foreground ml-1">{p.structured_formatting.secondary_text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
