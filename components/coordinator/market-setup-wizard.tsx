'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'
import { createClient } from '@/lib/supabase/client'
import { BoothPlanner } from '@/components/coordinator/booth-planner'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import {
  createLayoutRoom,
  getActiveRoom,
  layoutPayloadFromRooms,
  roomsFromBoothLayout,
  updateRoomInList,
} from '@/lib/booth-planner/layout-rooms'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  isLayoutBaselineTableLengthFt,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import {
  calculateMaxBoothCapacity,
  calculateNetUsableFloorSpace,
  boothUnitFootprint,
} from '@/lib/booth-planner/smart-populate-booth-caps'
import { hydrateVenuePreset, resolveTemplateAnchoredDimensions } from '@/lib/booth-planner/venue-presets'
import {
  getEdmontonVenueById,
  isEdmontonVenueId,
} from '@/lib/booth-planner/edmonton-venue-registry'
import type { VenuePresetId } from '@/lib/booth-planner/venue-presets'
import { sortCategoriesByName } from '@/lib/categories'
import { persistEventDraft, persistLayoutDraft } from '@/lib/wizard/wizard-autosave'
import {
  applyMlmLimitRules,
  DEFAULT_GLOBAL_MLM_CAP,
  hydrateMlmCategoryLimits,
} from '@/lib/categories/mlm-constraints'
import { useWizardCritiqueAgents } from '@/lib/wizard/critique/use-wizard-critique-agents'
import { DEFAULT_MARKET_CITY_ID, isEdmontonMarketCity, resolveMarketCityId } from '@/lib/wizard/market-cities'
import { effectiveScheduleTypeForListing, isQuarterAuctionListing } from '@/lib/events/listing-type'
import {
  defaultMarketTimesForListingType,
  WIZARD_PAGE_KICKER,
  WIZARD_PAGE_TITLE,
  WIZARD_PANEL,
} from '@/lib/wizard/wizard-panel-styles'
import { WizardCritiqueDrawer } from '@/components/coordinator/wizard/wizard-critique-drawer'
import { WizardQaSidebarPanel } from '@/components/coordinator/wizard/wizard-qa-sidebar-panel'
import { WizardNav, type WizardStep } from '@/components/coordinator/wizard/wizard-nav'
import {
  MARKET_WIZARD_STEPS_FULL,
  MARKET_WIZARD_STEPS_SHORT,
  WizardStepStepper,
} from '@/components/coordinator/wizard/wizard-step-stepper'
import { WizardStepCapacity } from '@/components/coordinator/wizard/wizard-step-capacity'
import { WizardStepEventDetails, type DayRow } from '@/components/coordinator/wizard/wizard-step-event-details'
import { WizardStepVenueWithMapsProvider } from '@/components/coordinator/wizard/wizard-step-venue'
import { WizardSummaryRail } from '@/components/coordinator/wizard/wizard-summary-rail'
import { WizardContextStrip } from '@/components/coordinator/wizard/wizard-context-strip'
import { buildWizardScheduleLines } from '@/lib/wizard/wizard-schedule-summary'
import { useFlyerScan } from '@/hooks/use-flyer-scan'
import { DeleteDraftMarketDialog } from '@/components/coordinator/delete-draft-market-dialog'
import { cn } from '@/lib/utils'
import type {
  BoothLayout,
  BoothClearancePolicy,
  Category,
  CoordinatorSavedVenue,
  Event,
  EventDay,
  EventListingType,
} from '@/types/database'

type ApplicationInput = Parameters<typeof BoothPlanner>[0]['applications']

export interface MarketSetupWizardProps {
  coordinatorId: string
  categories: Category[]
  existing?: Event | null
  existingLayout?: BoothLayout | null
  applications?: ApplicationInput
  initialStep?: WizardStep
}

function buildCategoryLimitsFromEvent(
  existing: Event | null | undefined,
  categories: Category[]
): CategoryLimit[] {
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
  const byId = new Map(categories.map((c) => [c.id, c]))
  const mapped = (limits ?? []).map((cl) => ({
    categoryId: cl.category_id,
    categoryName: cl.category?.name?.trim() || byId.get(cl.category_id)?.name || '',
    maxSlots: cl.max_slots,
    pricePerBooth: cl.price_per_booth,
    tableLengthFt: cl.table_length_ft ?? null,
  }))
  const cap = existing.max_mlm_slots ?? DEFAULT_GLOBAL_MLM_CAP
  return existing.allow_mlm ? hydrateMlmCategoryLimits(mapped, categories, cap) : mapped
}

function buildDayRows(existing: Event | null | undefined): DayRow[] {
  if (existing?.event_days && existing.event_days.length > 0) {
    return [...existing.event_days]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((d: EventDay) => ({
        date: d.date,
        start_time: d.start_time,
        end_time: d.end_time,
      }))
  }
  // Quarter-auction listings default to an evening 5:00 PM – 8:00 PM slot;
  // every other listing type uses the standard daytime market window.
  const { start, end } = defaultMarketTimesForListingType(existing?.listing_type)
  return [{ date: '', start_time: start, end_time: end }]
}

/**
 * Infer the highest reachable step for a draft. Step 1 is the combined
 * Event & Venue page — we only let the user past it once both sets of
 * fields are populated. Step 2 = Capacity, Step 3 = Floor Plan.
 */
function inferInitialMaxReachedStep(
  existing: Event | null | undefined,
  existingLayout: BoothLayout | null | undefined,
  skipVenueLayout: boolean,
  initialStep: WizardStep
): WizardStep {
  let max = initialStep

  const hasEventDetails =
    Boolean(existing?.name?.trim()) && Boolean(existing?.start_at) && Boolean(existing?.end_at)
  const hasVenueDetails =
    Boolean(existing?.location_name?.trim()) &&
    Boolean(existing?.address?.trim()) &&
    existing?.latitude != null

  if (hasEventDetails && hasVenueDetails) {
    max = Math.max(max, 2) as WizardStep
  }

  if (skipVenueLayout) {
    return Math.min(max, 2) as WizardStep
  }

  const limits = (existing as Event & { category_limits?: unknown[] })?.category_limits
  if (limits && limits.length > 0) {
    max = Math.max(max, 3) as WizardStep
  }
  if (existingLayout) {
    max = Math.max(max, 3) as WizardStep
  }

  return max
}

export function MarketSetupWizard({
  coordinatorId,
  categories,
  existing,
  existingLayout,
  applications = [],
  initialStep = 1,
}: MarketSetupWizardProps) {
  const router = useRouter()
  const supabase = createClient()
  const sortedCategories = sortCategoriesByName(categories)

  const initialRoomsState = useMemo(() => roomsFromBoothLayout(existingLayout ?? null), [existingLayout])

  const [eventId, setEventId] = useState<string | null>(existing?.id ?? null)
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep)
  const isDraftMode = !existing || existing.status === 'draft'
  const [maxReachedStep, setMaxReachedStep] = useState<WizardStep>(() =>
    inferInitialMaxReachedStep(existing, existingLayout ?? null, existing?.skip_venue_layout ?? false, initialStep)
  )
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [transitioning, setTransitioning] = useState(false)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [scheduleType, setScheduleType] = useState<'single' | 'multi'>(() => {
    if (existing && isQuarterAuctionListing(existing.listing_type)) return 'single'
    return existing?.is_multi_day ? 'multi' : 'single'
  })
  const [startDate, setStartDate] = useState(existing?.start_at ? existing.start_at.slice(0, 10) : '')
  const initialDefaultTimes = defaultMarketTimesForListingType(existing?.listing_type)
  const [startTime, setStartTime] = useState(
    existing?.start_at ? existing.start_at.slice(11, 16) : initialDefaultTimes.start
  )
  const [endDate, setEndDate] = useState(existing?.end_at ? existing.end_at.slice(0, 10) : '')
  const [endTime, setEndTime] = useState(
    existing?.end_at ? existing.end_at.slice(11, 16) : initialDefaultTimes.end
  )
  const [dayRows, setDayRows] = useState<DayRow[]>(() => buildDayRows(existing))
  const [bookingMode, setBookingMode] = useState<'instant' | 'juried'>(existing?.booking_mode ?? 'juried')
  const [listingType, setListingType] = useState<EventListingType>(
    existing?.listing_type ?? 'community_market'
  )
  const [requireFullAttendance, setRequireFullAttendance] = useState(
    existing?.require_full_attendance ?? true
  )
  const [marketInsuranceRequired, setMarketInsuranceRequired] = useState(
    existing?.market_insurance_required ?? false
  )
  const [allowMlm, setAllowMlm] = useState(existing?.allow_mlm ?? false)
  const [globalMlmCap, setGlobalMlmCap] = useState(existing?.max_mlm_slots ?? DEFAULT_GLOBAL_MLM_CAP)
  const [boothClearancePolicy, setBoothClearancePolicy] = useState<BoothClearancePolicy>(
    existing?.booth_clearance_policy ?? 'leave_furniture'
  )
  const [raffleDonationRequirement, setRaffleDonationRequirement] = useState(
    existing?.raffle_donation_requirement ?? ''
  )
  const [coverImageUrl, setCoverImageUrl] = useState(existing?.cover_image_url ?? '')
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const { parsing: parsingFlyer, autoFilledFields, scanFlyer } = useFlyerScan()

  const [locationName, setLocationName] = useState(existing?.location_name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [lat, setLat] = useState(existing?.latitude ?? 53.5461)
  const [lng, setLng] = useState(existing?.longitude ?? -113.4938)
  const [pinDropped, setPinDropped] = useState(!!existing?.latitude)
  const [skipVenueLayout, setSkipVenueLayout] = useState(existing?.skip_venue_layout ?? false)

  const totalSteps = skipVenueLayout ? 2 : 3
  const wizardSteps = skipVenueLayout ? MARKET_WIZARD_STEPS_SHORT : MARKET_WIZARD_STEPS_FULL

  function syncStepInUrl(step: WizardStep, resolvedEventId?: string | null) {
    const id = resolvedEventId ?? eventId
    if (!id || typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('step', String(step))
    window.history.replaceState(null, '', `${url.pathname}${url.search}`)
  }

  function advanceToStep(nextStep: WizardStep, resolvedEventId?: string | null) {
    setCurrentStep(nextStep)
    setMaxReachedStep((prev) => Math.max(prev, nextStep) as WizardStep)
    syncStepInUrl(nextStep, resolvedEventId)
  }

  const [rooms, setRooms] = useState(initialRoomsState.rooms)
  const [activeRoomId, setActiveRoomId] = useState(initialRoomsState.activeRoomId)
  const activeRoom = useMemo(() => getActiveRoom(rooms, activeRoomId), [rooms, activeRoomId])

  function handleSelectRoom(roomId: string) {
    setActiveRoomId(roomId)
  }

  function handleAddRoom() {
    const room = createLayoutRoom(
      rooms.length === 0 ? 'Main Hall' : `Room ${rooms.length + 1}`
    )
    setRooms((prev) => [...prev, room])
    setActiveRoomId(room.id)
    toast.success(`Added ${room.name}`)
  }

  function handleRenameRoom(roomId: string, name: string) {
    setRooms((prev) => updateRoomInList(prev, roomId, { name }))
  }

  function handleDeleteRoom(roomId: string) {
    if (rooms.length <= 1) {
      toast.error('At least one room is required')
      return
    }
    const room = rooms.find((r) => r.id === roomId)
    if (
      !window.confirm(
        `Delete "${room?.name ?? 'this room'}"? Its booths and fixtures will be removed.`
      )
    ) {
      return
    }
    const next = rooms.filter((r) => r.id !== roomId)
    setRooms(next)
    if (activeRoomId === roomId) setActiveRoomId(next[0]!.id)
    toast.message('Room deleted')
  }

  const handleLayoutRoomsChange = useCallback((nextRooms: typeof rooms, nextActiveRoomId: string) => {
    setRooms(nextRooms)
    setActiveRoomId(nextActiveRoomId)
  }, [])

  const venuePresetId: VenuePresetId =
    (activeRoom.venue_preset_id as VenuePresetId | null | undefined) ?? 'blank'

  const [marketCity, setMarketCity] = useState(() =>
    resolveMarketCityId(existing?.market_city, existing?.address)
  )

  const templateAnchor = useMemo(
    () => resolveTemplateAnchoredDimensions(venuePresetId, activeRoom.venue_width, activeRoom.venue_length),
    [venuePresetId, activeRoom.venue_width, activeRoom.venue_length]
  )

  const [categoryLimits, setCategoryLimits] = useState<CategoryLimit[]>(() =>
    buildCategoryLimitsFromEvent(existing, categories)
  )

  const baselineTableLengthFt: LayoutBaselineTableLengthFt = useMemo(() => {
    const ft = activeRoom.baseline_table_length_ft
    if (ft != null && isLayoutBaselineTableLengthFt(ft)) return ft
    return DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  }, [activeRoom.baseline_table_length_ft])

  const categoryTableLengths = useMemo(() => {
    const map: Record<string, number | null> = {}
    for (const cl of categoryLimits) {
      map[cl.categoryId] = cl.tableLengthFt ?? null
    }
    return map
  }, [categoryLimits])

  const eventCategoryNames = useMemo(
    () => categoryLimits.map((cl) => cl.categoryName).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [categoryLimits]
  )

  const layoutCapacity = useMemo(() => {
    const floor = calculateNetUsableFloorSpace(templateAnchor.width, templateAnchor.length, {
      venueElements: activeRoom.venue_elements,
      entrance: activeRoom.entrance,
    })
    const footprint = boothUnitFootprint(baselineTableLengthFt)
    return calculateMaxBoothCapacity(floor.netUsableSqFt, footprint.sqFt)
  }, [templateAnchor, activeRoom.venue_elements, activeRoom.entrance, baselineTableLengthFt])

  const saveLayoutRef = useRef<(() => Promise<boolean>) | null>(null)
  const saveBlankLayoutRef = useRef<(() => Promise<boolean>) | null>(null)
  const autoPlanRef = useRef<(() => Promise<boolean>) | null>(null)
  const populatePlaceholdersRef = useRef<(() => Promise<boolean>) | null>(null)
  const [plannerOverlap, setPlannerOverlap] = useState(false)
  const [plannerQaRunning, setPlannerQaRunning] = useState(false)

  const scheduleLines = useMemo(
    () =>
      buildWizardScheduleLines({
        scheduleType,
        dayRows,
        startDate,
        startTime,
        endTime,
      }),
    [scheduleType, dayRows, startDate, startTime, endTime]
  )

  // Workspace steps (Capacity, Floor Plan) get a wider, panel-less layout.
  // Step 1 = combined Event & Venue (form-style), Step 2 = Capacity,
  // Step 3 = Floor Plan canvas.
  const isWorkspaceStep = currentStep >= 2

  const selectedVenue = useMemo(() => {
    // Step 1 already captures venue info (combined Event & Venue), so we
    // surface the live selection from the very first step onward.
    const trimmedName = locationName.trim()
    const trimmedAddress = address.trim() || undefined

    if (skipVenueLayout && trimmedName) {
      return {
        name: trimmedName,
        address: trimmedAddress,
        locationOnly: true as const,
      }
    }

    if (templateAnchor.isAnchored && templateAnchor.preset) {
      return {
        name: trimmedName || templateAnchor.preset.label,
        address: trimmedAddress,
        width: templateAnchor.width,
        length: templateAnchor.length,
      }
    }

    if (trimmedName) {
      return {
        name: trimmedName,
        address: trimmedAddress,
        ...(pinDropped
          ? { width: templateAnchor.width, length: templateAnchor.length }
          : {}),
      }
    }

    return null
  }, [templateAnchor, locationName, address, pinDropped, currentStep, skipVenueLayout])

  const summaryCapacityLabel = useMemo(() => {
    const total = categoryLimits.reduce((s, cl) => s + cl.maxSlots, 0)
    if (total > 0) return String(total)
    if (currentStep >= 2) return String(layoutCapacity)
    return null
  }, [categoryLimits, layoutCapacity, currentStep])

  const { findings, dismiss } = useWizardCritiqueAgents(
    {
      currentStep,
      eventName: name,
      description,
      hasOverlap: plannerOverlap,
      undismissedAlertCount: 0,
      venueWidth: templateAnchor.width,
      venueLength: templateAnchor.length,
      templateWidth: templateAnchor.preset?.canvasWidth,
      templateLength: templateAnchor.preset?.canvasHeight,
      gridCols: templateAnchor.width,
      gridRows: templateAnchor.length,
      pinDropped,
      iterationLimitHit: false,
      qaRunning: plannerQaRunning,
      qaCancelled: false,
      saveBlocked: plannerOverlap,
    },
    100
  )

  function sortedDayRows(): DayRow[] {
    return [...dayRows].sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
  }

  function resolveScheduleBounds(): { startAt: string; endAt: string } | null {
    const effectiveSchedule = effectiveScheduleTypeForListing(listingType, scheduleType)
    if (effectiveSchedule === 'multi') {
      const filledRows = dayRows.filter((r) => r.date && r.start_time && r.end_time)
      if (filledRows.length === 0) return null
      if (dayRows.some((r) => !r.date || !r.start_time || !r.end_time)) return null
      const sorted = sortedDayRows()
      return {
        startAt: new Date(`${sorted[0].date}T${sorted[0].start_time}`).toISOString(),
        endAt: new Date(`${sorted[sorted.length - 1].date}T${sorted[sorted.length - 1].end_time}`).toISOString(),
      }
    }
    if (!startDate || !startTime || !endDate || !endTime) return null
    if (new Date(`${endDate}T${endTime}`) <= new Date(`${startDate}T${startTime}`)) return null
    return {
      startAt: new Date(`${startDate}T${startTime}`).toISOString(),
      endAt: new Date(`${endDate}T${endTime}`).toISOString(),
    }
  }

  async function uploadCoverIfNeeded(resolvedEventId: string): Promise<string | null> {
    if (!coverFile) return coverImageUrl || null
    const ext = coverFile.name.split('.').pop() ?? 'jpg'
    const path = `${coordinatorId}/${resolvedEventId}/cover.${ext}`
    const { error } = await supabase.storage.from('event-covers').upload(path, coverFile, { upsert: true })
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from('event-covers').getPublicUrl(path)
    return data.publicUrl
  }

  const autosave = useCallback(
    async (opts?: { publish?: boolean }) => {
      const bounds = resolveScheduleBounds()
      if (!bounds) return { ok: false as const, reason: 'schedule' as const }

      setAutosaveStatus('saving')
      try {
        let coverUrl = coverImageUrl || null
        if (coverFile && eventId) {
          coverUrl = await uploadCoverIfNeeded(eventId)
          setCoverImageUrl(coverUrl ?? '')
          setCoverFile(null)
        }

        const draftResult = await persistEventDraft(
          supabase,
          eventId,
          {
            coordinatorId,
            name,
            description,
            locationName,
            address,
            latitude: lat,
            longitude: lng,
            bookingMode,
            listingType,
            allowMlm,
            maxMlmSlots: globalMlmCap,
            requireFullAttendance,
            marketInsuranceRequired,
            skipVenueLayout,
            marketCity,
            boothClearancePolicy,
            raffleDonationRequirement,
            scheduleType,
            startAt: bounds.startAt,
            endAt: bounds.endAt,
            coverImageUrl: coverUrl,
            status: opts?.publish ? 'published' : 'draft',
          },
          categoryLimits,
          dayRows,
          scheduleType
        )

        if (draftResult.error) throw draftResult.error
        if (!eventId && draftResult.eventId) {
          setEventId(draftResult.eventId)
          window.history.replaceState(null, '', `/coordinator/events/${draftResult.eventId}/setup`)
        }

        const resolvedId = draftResult.eventId || eventId
        // Step 1 already captures venue dimensions (combined Event & Venue
        // step), so the layout payload is meaningful from the very first
        // autosave onward as long as the coordinator hasn't opted out.
        if (resolvedId && !skipVenueLayout) {
          const layoutPayload = layoutPayloadFromRooms(resolvedId, rooms, activeRoomId)
          const layoutResult = await persistLayoutDraft(supabase, resolvedId, layoutPayload)
          if (layoutResult.error) throw layoutResult.error
        }

        if (coverFile && resolvedId && !coverUrl) {
          coverUrl = await uploadCoverIfNeeded(resolvedId)
          await supabase.from('events').update({ cover_image_url: coverUrl }).eq('id', resolvedId)
        }

        setAutosaveStatus('saved')
        return { ok: true as const, eventId: resolvedId }
      } catch (err) {
        console.error(err)
        setAutosaveStatus('error')
        return { ok: false as const, reason: 'error' as const }
      }
    },
    [
      activeRoomId,
      address,
      allowMlm,
      bookingMode,
      boothClearancePolicy,
      categoryLimits,
      coordinatorId,
      coverFile,
      coverImageUrl,
      currentStep,
      dayRows,
      description,
      endDate,
      endTime,
      eventId,
      globalMlmCap,
      lat,
      lng,
      listingType,
      locationName,
      name,
      raffleDonationRequirement,
      requireFullAttendance,
      marketInsuranceRequired,
      marketCity,
      rooms,
      scheduleType,
      skipVenueLayout,
      startDate,
      startTime,
      supabase,
    ]
  )

  function handleListingTypeChange(next: EventListingType) {
    const prev = listingType
    setListingType(next)
    if (isQuarterAuctionListing(next)) {
      setSkipVenueLayout(true)
      setScheduleType('single')
    }
    // When the listing type *flips* between QA and standard market, retune
    // the schedule defaults so the form mirrors the typical event window
    // (5:00 PM – 8:00 PM for quarter auctions, 8:00 AM – 3:00 PM otherwise).
    // Only overwrite values that still match the previous default — never
    // clobber a coordinator-edited time.
    if (isQuarterAuctionListing(prev) === isQuarterAuctionListing(next)) return
    const prevDefaults = defaultMarketTimesForListingType(prev)
    const nextDefaults = defaultMarketTimesForListingType(next)
    setStartTime((current) => (current === prevDefaults.start ? nextDefaults.start : current))
    setEndTime((current) => (current === prevDefaults.end ? nextDefaults.end : current))
    setDayRows((rows) =>
      rows.map((row) => ({
        ...row,
        start_time: row.start_time === prevDefaults.start ? nextDefaults.start : row.start_time,
        end_time: row.end_time === prevDefaults.end ? nextDefaults.end : row.end_time,
      }))
    )
  }

  function handleScheduleTypeChange(next: 'single' | 'multi') {
    if (isQuarterAuctionListing(listingType) && next === 'multi') {
      toast.error('Quarter auctions must be single-day events.')
      return
    }
    setScheduleType(next)
  }

  function handleGlobalMlmCapChange(cap: number) {
    setGlobalMlmCap(cap)
    if (allowMlm) {
      setCategoryLimits((prev) => applyMlmLimitRules(prev, sortedCategories, cap))
    }
  }

  function handleCategoryLimitsChange(limits: CategoryLimit[]) {
    setCategoryLimits(
      allowMlm ? applyMlmLimitRules(limits, sortedCategories, globalMlmCap) : limits
    )
  }

  function handleVenuePresetChange(presetId: VenuePresetId) {
    const patch = hydrateVenuePreset(presetId)
    setRooms((prev) => updateRoomInList(prev, activeRoomId, patch))

    if (presetId === 'blank') return

    const blueprint = getEdmontonVenueById(presetId)
    if (!blueprint) return

    setLocationName(blueprint.label)
    setAddress(blueprint.address)
    setLat(blueprint.latitude)
    setLng(blueprint.longitude)
    setPinDropped(true)
    setMarketCity(DEFAULT_MARKET_CITY_ID)
  }

  function handleMarketCityChange(cityId: string) {
    setMarketCity(cityId)
    if (!isEdmontonMarketCity(cityId) && isEdmontonVenueId(venuePresetId)) {
      handleVenuePresetChange('blank')
    }
  }

  function handleApplySavedVenue(venue: CoordinatorSavedVenue) {
    setSkipVenueLayout(venue.skip_venue_layout)

    const presetId = venue.venue_preset_id
    if (presetId && presetId !== 'blank' && isEdmontonVenueId(presetId)) {
      handleVenuePresetChange(presetId as VenuePresetId)
      return
    }

    setLocationName(venue.location_name)
    setAddress(venue.address)
    setLat(venue.latitude)
    setLng(venue.longitude)
    setPinDropped(true)
    setMarketCity(resolveMarketCityId(venue.market_city, venue.address))
  }

  function handleBaselineTableLengthChange(ft: LayoutBaselineTableLengthFt) {
    setRooms((prev) => updateRoomInList(prev, activeRoomId, { baseline_table_length_ft: ft }))
  }

  async function handleCoverFileSelected(file: File) {
    setCoverFile(file)
    setCoverImageUrl(URL.createObjectURL(file))
    await scanFlyer(file, {
      setEventName: setName,
      setDescription: setDescription,
      setStartDate,
      setEndDate,
      setStartTime,
      setEndTime,
      setLocationName,
      setAddress,
      setRaffleDonationRequirement,
      setListingType: (value) => {
        if (value === 'garage_yard_sale') {
          handleListingTypeChange('garage_yard_sale')
        }
      },
    })
  }

  function handleApplyWeekendRange(range: { startDate: string; endDate: string }) {
    const effective = effectiveScheduleTypeForListing(listingType, scheduleType)
    const { start: defaultStart, end: defaultEnd } =
      defaultMarketTimesForListingType(listingType)
    if (effective === 'multi') {
      setDayRows([
        {
          date: range.startDate,
          start_time: defaultStart,
          end_time: defaultEnd,
        },
        {
          date: range.endDate,
          start_time: defaultStart,
          end_time: defaultEnd,
        },
      ])
      return
    }
    setStartDate(range.startDate)
    setEndDate(range.startDate)
  }

  /**
   * Combined Step 1 (Event & Venue) validation — checks event name, schedule
   * bounds, listing-type rules, AND venue location / map pin / template
   * dimensions in a single pass.
   */
  function validateStep1(): boolean {
    if (!name.trim()) {
      toast.error('Event name is required')
      return false
    }
    if (isQuarterAuctionListing(listingType) && scheduleType === 'multi') {
      toast.error('Quarter auctions must be single-day events.')
      return false
    }
    const bounds = resolveScheduleBounds()
    if (!bounds) {
      toast.error('Complete schedule dates and times before continuing')
      return false
    }

    if (skipVenueLayout) {
      if (!locationName.trim()) {
        toast.error('Venue name is required')
        return false
      }
      if (!address.trim()) {
        toast.error('Venue address is required')
        return false
      }
      if (!pinDropped) {
        toast.error('Drop a map pin for the venue location')
        return false
      }
      return true
    }
    if (templateAnchor.width < 10 || templateAnchor.length < 10) {
      toast.error('Select a venue template or set dimensions (min 10 ft)')
      return false
    }
    if (!pinDropped) {
      toast.error('Drop a map pin for the venue location')
      return false
    }
    return true
  }

  async function goNext() {
    if (transitioning) return
    setTransitioning(true)
    try {
      // Step 1 — combined Event & Venue. Validate both halves, autosave,
      // and advance to Capacity.
      if (currentStep === 1) {
        if (!validateStep1()) return
        const result = await autosave()
        if (!result.ok) {
          toast.error('Could not save draft — check schedule and venue fields')
          return
        }
        advanceToStep(2, result.eventId)
        return
      }
      // Step 2 — Capacity. If the user opted out of the layout canvas the
      // wizard publishes here; otherwise advance to the Floor Plan.
      if (currentStep === 2) {
        if (skipVenueLayout) {
          const result = await autosave({ publish: true })
          if (!result.ok || !result.eventId) {
            toast.error('Failed to deploy market')
            return
          }
          toast.success('Market saved and deployed!')
          await revalidateMarketsCacheClient()
          router.push(`/coordinator/events/${result.eventId}`)
          return
        }
        const result = await autosave()
        if (!result.ok) {
          toast.error('Could not save capacity settings')
          return
        }
        advanceToStep(3, result.eventId)
        return
      }
      // Step 3 — Floor Plan. Final deploy after layout overlap check.
      if (currentStep === 3) {
        if (plannerOverlap) {
          toast.error('Resolve layout overlaps before deploying')
          return
        }
        const saveFn = saveLayoutRef.current
        if (saveFn) {
          const saved = await saveFn()
          if (!saved) return
        }
        const result = await autosave({ publish: true })
        if (!result.ok || !result.eventId) {
          toast.error('Failed to deploy market')
          return
        }
        toast.success('Market saved and deployed!')
        await revalidateMarketsCacheClient()
        router.push(`/coordinator/events/${result.eventId}`)
      }
    } finally {
      setTransitioning(false)
    }
  }

  function goBack() {
    if (currentStep > 1) {
      const prev = (currentStep - 1) as WizardStep
      setCurrentStep(prev)
      syncStepInUrl(prev)
    }
  }

  async function goToStep(step: WizardStep) {
    if (!isDraftMode || step > maxReachedStep || step === currentStep || transitioning) return
    if (skipVenueLayout && step === 3) return

    setTransitioning(true)
    try {
      const result = await autosave()
      if (!result.ok) {
        toast.error('Could not save draft before switching steps')
        return
      }
      setCurrentStep(step)
      syncStepInUrl(step)
    } finally {
      setTransitioning(false)
    }
  }

  useEffect(() => {
    const cap = skipVenueLayout ? 2 : 3
    setMaxReachedStep((prev) => Math.min(prev, cap) as WizardStep)
  }, [skipVenueLayout])

  useEffect(() => {
    if (skipVenueLayout && currentStep === 3) {
      setCurrentStep(2)
    }
  }, [skipVenueLayout, currentStep])

  useEffect(() => {
    if (currentStep === 3 && !eventId) {
      setCurrentStep(2)
      toast.error('Save event details before opening the canvas')
    }
  }, [currentStep, eventId])

  const hasAutoPopulatedRef = useRef(false)
  useEffect(() => {
    if (currentStep !== 3 || skipVenueLayout || !eventId) return
    if (hasAutoPopulatedRef.current) return

    const totalConfiguredSlots = categoryLimits.reduce((sum, cl) => sum + (cl.maxSlots ?? 0), 0)
    if (totalConfiguredSlots <= 0) return

    const placedCount = rooms.reduce(
      (sum, room) => sum + room.cells.filter((c) => c.col >= 0 && c.row >= 0).length,
      0
    )
    if (placedCount > 0) {
      hasAutoPopulatedRef.current = true
      return
    }

    const handle = window.setTimeout(() => {
      hasAutoPopulatedRef.current = true
      // Prefer the slot-to-booth placeholder generator when available so the
      // canvas mirrors the configured Step 3 caps exactly. Fall back to the
      // legacy Smart Populate path if the placeholder ref hasn't mounted yet.
      const populate = populatePlaceholdersRef.current ?? autoPlanRef.current
      void populate?.()
    }, 250)
    return () => window.clearTimeout(handle)
  }, [currentStep, skipVenueLayout, eventId, categoryLimits, rooms])

  const isFloorPlanStep = currentStep === 3 && !skipVenueLayout

  return (
    <div
      className={cn(
        isFloorPlanStep
          ? 'mx-[calc(50%-50vw)] flex w-screen flex-col gap-2 px-2 pb-3 sm:px-3 sm:pb-4 lg:px-4'
          : 'space-y-6'
      )}
    >
      {isFloorPlanStep ? (
        <header className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <p className={cn(WIZARD_PAGE_KICKER, 'mb-0')}>
              Step {currentStep} of {totalSteps}
            </p>
            {name.trim() ? (
              <span className="text-sm font-semibold text-foreground truncate max-w-[28ch]">
                {name.trim()}
              </span>
            ) : null}
          </div>
          {isDraftMode && eventId ? (
            <DeleteDraftMarketDialog eventId={eventId} eventName={name} />
          ) : null}
        </header>
      ) : (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <p className={WIZARD_PAGE_KICKER}>
              Market Setup Wizard · Step {currentStep} of {totalSteps}
            </p>
            <h1 className={WIZARD_PAGE_TITLE}>
              {existing ? 'Edit Market' : 'Create New Market'}
            </h1>
          </div>
          {isDraftMode && eventId ? (
            <DeleteDraftMarketDialog eventId={eventId} eventName={name} />
          ) : null}
        </header>
      )}

      {isDraftMode ? (
        <WizardStepStepper
          steps={wizardSteps}
          currentStep={currentStep}
          maxReachedStep={maxReachedStep}
          allowNavigation
          onStepChange={(step) => void goToStep(step)}
        />
      ) : null}

      <div
        className={cn(
          'flex w-full items-stretch gap-4',
          // Always stack vertically so every panel below the wizard timeline
          // spans the same horizontal width as the timeline component itself.
          'flex-col',
          isFloorPlanStep ? 'flex-1 min-h-0 gap-2' : null
        )}
      >
        {isWorkspaceStep && !isFloorPlanStep ? (
          <WizardContextStrip
            stepLabel={currentStep === 2 ? 'Step 2 — Capacity' : 'Step 3 — Floor plan'}
            eventName={name.trim() || null}
            scheduleLines={scheduleLines}
            selectedVenue={selectedVenue}
            capacityLabel={summaryCapacityLabel}
            tableSizeLabel={
              currentStep >= 2 && !skipVenueLayout ? `${baselineTableLengthFt}′ tables` : null
            }
          />
        ) : null}

        <div
          className={cn(
            // Workspace column matches the wizard timeline's full horizontal
            // width — always w-full now that the rail is stacked beneath.
            'w-full min-w-0',
              isFloorPlanStep
                ? 'flex flex-1 min-h-0 flex-col gap-2'
                : cn(
                    WIZARD_PANEL,
                    'space-y-3',
                    currentStep === 3 ? 'p-2 sm:p-3' : isWorkspaceStep ? 'p-3 sm:p-4' : 'p-4 sm:p-5'
                  )
          )}
        >
          {currentStep === 3 && !skipVenueLayout ? (
            <LayoutRoomBar
              rooms={rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              onAddRoom={handleAddRoom}
              onRenameRoom={handleRenameRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          ) : null}

          {/* Step 1 — combined Event & Venue. Both halves of the legacy
             Step 1 / Step 2 render together so coordinators can fill the
             entire setup in a single page transition. */}
          {currentStep === 1 ? (
            <div className="space-y-6">
              <WizardStepEventDetails
                name={name}
                onNameChange={setName}
                description={description}
                onDescriptionChange={setDescription}
                scheduleType={scheduleType}
                onScheduleTypeChange={handleScheduleTypeChange}
                startDate={startDate}
                onStartDateChange={setStartDate}
                startTime={startTime}
                onStartTimeChange={setStartTime}
                endDate={endDate}
                onEndDateChange={setEndDate}
                endTime={endTime}
                onEndTimeChange={setEndTime}
                dayRows={dayRows}
                onDayRowsChange={setDayRows}
                bookingMode={bookingMode}
                onBookingModeChange={setBookingMode}
                listingType={listingType}
                onListingTypeChange={handleListingTypeChange}
                requireFullAttendance={requireFullAttendance}
                onRequireFullAttendanceChange={setRequireFullAttendance}
                marketInsuranceRequired={marketInsuranceRequired}
                onMarketInsuranceRequiredChange={setMarketInsuranceRequired}
                onApplyWeekendRange={handleApplyWeekendRange}
                allowMlm={allowMlm}
                onAllowMlmChange={setAllowMlm}
                boothClearancePolicy={boothClearancePolicy}
                onBoothClearancePolicyChange={setBoothClearancePolicy}
                raffleDonationRequirement={raffleDonationRequirement}
                onRaffleDonationRequirementChange={setRaffleDonationRequirement}
                coverImageUrl={coverImageUrl}
                onCoverFileSelected={handleCoverFileSelected}
                parsingFlyer={parsingFlyer}
                autoFilledFields={autoFilledFields}
              />
              <div className="border-t-2 border-stone-200/60" aria-hidden />
              <WizardStepVenueWithMapsProvider
                venuePresetId={venuePresetId}
                onVenuePresetChange={handleVenuePresetChange}
                city={marketCity}
                onCityChange={handleMarketCityChange}
                locationName={locationName}
                onLocationNameChange={setLocationName}
                address={address}
                onAddressChange={setAddress}
                lat={lat}
                lng={lng}
                onCoordinatesChange={(nextLat, nextLng) => {
                  setLat(nextLat)
                  setLng(nextLng)
                }}
                pinDropped={pinDropped}
                onPinDroppedChange={setPinDropped}
                venueWidth={templateAnchor.width}
                venueLength={templateAnchor.length}
                skipVenueLayout={skipVenueLayout}
                onSkipVenueLayoutChange={setSkipVenueLayout}
                coordinatorId={coordinatorId}
                onApplySavedVenue={handleApplySavedVenue}
              />
              <WizardNav step={1} onNext={goNext} nextDisabled={transitioning} />
            </div>
          ) : null}

          {/* Step 2 — Capacity (was Step 3 in the legacy 4-step flow). */}
          {currentStep === 2 ? (
            <>
              <WizardStepCapacity
                categories={sortedCategories}
                allowMlm={allowMlm}
                venueWidth={templateAnchor.width}
                venueLength={templateAnchor.length}
                venueReadOnly={templateAnchor.isAnchored}
                categoryLimits={categoryLimits}
                onCategoryLimitsChange={handleCategoryLimitsChange}
                globalMlmCap={globalMlmCap}
                onGlobalMlmCapChange={handleGlobalMlmCapChange}
                baselineTableLengthFt={baselineTableLengthFt}
                onBaselineTableLengthChange={handleBaselineTableLengthChange}
                layoutCapacity={layoutCapacity}
                venueElements={activeRoom.venue_elements}
                entrance={activeRoom.entrance}
                skipVenueLayout={skipVenueLayout}
              />
              <WizardNav
                step={2}
                onBack={goBack}
                onNext={goNext}
                nextDisabled={transitioning}
                nextLabel={skipVenueLayout ? 'Save & deploy market' : undefined}
              />
            </>
          ) : null}

          {/* Step 3 — Floor Plan (was Step 4). */}
          {currentStep === 3 && eventId && !skipVenueLayout ? (
            <>
              <BoothPlanner
                eventId={eventId}
                existingLayout={
                  layoutPayloadFromRooms(eventId, rooms, activeRoomId) as unknown as BoothLayout
                }
                applications={applications}
                categoryTableLengths={categoryTableLengths}
                eventCategoryNames={eventCategoryNames}
                allCategories={sortedCategories}
                allowMlm={allowMlm}
                canvasOnly
                hideInternalNav
                hideRoomBar
                layoutRooms={rooms}
                layoutActiveRoomId={activeRoomId}
                onLayoutRoomsChange={handleLayoutRoomsChange}
                saveLayoutRef={saveLayoutRef}
                saveBlankLayoutRef={saveBlankLayoutRef}
                autoPlanRef={autoPlanRef}
                populatePlaceholdersRef={populatePlaceholdersRef}
                onOverlapChange={setPlannerOverlap}
                onLiveQaChange={({ qaRunning }) => setPlannerQaRunning(qaRunning)}
                configuredSlotTotal={categoryLimits.reduce(
                  (sum, cl) => sum + (cl.maxSlots ?? 0),
                  0
                )}
                configuredCategorySlots={categoryLimits.map((cl) => ({
                  categoryId: cl.categoryId,
                  categoryName: cl.categoryName,
                  maxSlots: cl.maxSlots,
                }))}
                rightSidebarExtra={
                  <WizardQaSidebarPanel
                    findings={findings}
                    onDismiss={dismiss}
                    onGoToStep={(step) => void goToStep(step as WizardStep)}
                  />
                }
              />
              <WizardNav step={3} onBack={goBack} onNext={goNext} nextDisabled={transitioning || plannerOverlap} />
            </>
          ) : null}
        </div>

        {!isWorkspaceStep ? (
          <WizardSummaryRail
            eventName={name.trim() || null}
            scheduleLines={scheduleLines}
            selectedVenue={selectedVenue}
            capacityLabel={summaryCapacityLabel}
            tableSizeLabel={currentStep >= 2 && !skipVenueLayout ? `Table size: ${baselineTableLengthFt} ft` : null}
            autosaveStatus={autosaveStatus}
          />
        ) : null}
      </div>

      {currentStep !== 3 ? (
        <WizardCritiqueDrawer
          findings={findings}
          onDismiss={dismiss}
          onGoToStep={(step) => void goToStep(step as WizardStep)}
        />
      ) : null}
    </div>
  )
}
