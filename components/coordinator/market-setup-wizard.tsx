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
  type EdmontonQuadrantFilter,
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
import { DEFAULT_MARKET_END, DEFAULT_MARKET_START, WIZARD_PAGE_KICKER, WIZARD_PAGE_TITLE, WIZARD_PANEL } from '@/lib/wizard/wizard-panel-styles'
import { WizardCritiqueDrawer } from '@/components/coordinator/wizard/wizard-critique-drawer'
import { WizardNav, type WizardStep } from '@/components/coordinator/wizard/wizard-nav'
import { WizardStepCapacity } from '@/components/coordinator/wizard/wizard-step-capacity'
import { WizardStepEventDetails, type DayRow } from '@/components/coordinator/wizard/wizard-step-event-details'
import { WizardStepVenueWithMapsProvider } from '@/components/coordinator/wizard/wizard-step-venue'
import { WizardSummaryRail } from '@/components/coordinator/wizard/wizard-summary-rail'
import { formatTimeLabel, formatShortDate } from '@/components/coordinator/wizard/wizard-time-options'
import type { BoothLayout, BoothClearancePolicy, Category, Event, EventDay, EventListingType } from '@/types/database'

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
  const mapped = (limits ?? []).map((cl) => ({
    categoryId: cl.category_id,
    categoryName: cl.category?.name ?? '',
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
  return [{ date: '', start_time: DEFAULT_MARKET_START, end_time: DEFAULT_MARKET_END }]
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
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [transitioning, setTransitioning] = useState(false)

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [scheduleType, setScheduleType] = useState<'single' | 'multi'>(
    existing?.is_multi_day ? 'multi' : 'single'
  )
  const [startDate, setStartDate] = useState(existing?.start_at ? existing.start_at.slice(0, 10) : '')
  const [startTime, setStartTime] = useState(existing?.start_at ? existing.start_at.slice(11, 16) : DEFAULT_MARKET_START)
  const [endDate, setEndDate] = useState(existing?.end_at ? existing.end_at.slice(0, 10) : '')
  const [endTime, setEndTime] = useState(existing?.end_at ? existing.end_at.slice(11, 16) : DEFAULT_MARKET_END)
  const [dayRows, setDayRows] = useState<DayRow[]>(() => buildDayRows(existing))
  const [bookingMode, setBookingMode] = useState<'instant' | 'juried'>(existing?.booking_mode ?? 'juried')
  const [listingType, setListingType] = useState<EventListingType>(
    existing?.listing_type ?? 'community_market'
  )
  const [requireFullAttendance, setRequireFullAttendance] = useState(
    existing?.require_full_attendance ?? true
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

  const [locationName, setLocationName] = useState(existing?.location_name ?? '')
  const [address, setAddress] = useState(existing?.address ?? '')
  const [lat, setLat] = useState(existing?.latitude ?? 53.5461)
  const [lng, setLng] = useState(existing?.longitude ?? -113.4938)
  const [pinDropped, setPinDropped] = useState(!!existing?.latitude)
  const [skipVenueLayout, setSkipVenueLayout] = useState(existing?.skip_venue_layout ?? false)

  const totalSteps = skipVenueLayout ? 3 : 4

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

  const [cityQuadrant, setCityQuadrant] = useState<EdmontonQuadrantFilter>(() => {
    if (venuePresetId === 'blank') return 'all'
    return getEdmontonVenueById(venuePresetId)?.quadrant ?? 'all'
  })

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
  const [plannerOverlap, setPlannerOverlap] = useState(false)
  const [plannerQaRunning, setPlannerQaRunning] = useState(false)

  const scheduleSummary = useMemo(() => {
    if (scheduleType === 'multi') {
      const filled = sortedDayRows().filter((r) => r.date && r.start_time && r.end_time)
      if (filled.length === 0) return null
      return filled
        .map(
          (r) =>
            `${formatShortDate(r.date)} · ${formatTimeLabel(r.start_time)} – ${formatTimeLabel(r.end_time)}`
        )
        .join('\n')
    }
    if (startDate && startTime && endTime) {
      return `${formatShortDate(startDate)} · ${formatTimeLabel(startTime)} – ${formatTimeLabel(endTime)}`
    }
    return null
  }, [scheduleType, dayRows, startDate, startTime, endTime])

  const selectedVenue = useMemo(() => {
    if (skipVenueLayout && locationName.trim() && address.trim()) {
      return {
        name: locationName.trim(),
        address: address.trim(),
        locationOnly: true as const,
      }
    }
    if (templateAnchor.isAnchored && templateAnchor.preset) {
      return {
        name: locationName.trim() || templateAnchor.preset.label,
        width: templateAnchor.width,
        length: templateAnchor.length,
      }
    }
    if (pinDropped && locationName.trim() && currentStep >= 2) {
      return {
        name: locationName.trim(),
        width: templateAnchor.width,
        length: templateAnchor.length,
      }
    }
    return null
  }, [templateAnchor, locationName, address, pinDropped, currentStep, skipVenueLayout])

  const summaryCapacityLabel = useMemo(() => {
    const total = categoryLimits.reduce((s, cl) => s + cl.maxSlots, 0)
    if (total > 0) return String(total)
    if (currentStep >= 3) return String(layoutCapacity)
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
    if (scheduleType === 'multi') {
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
            skipVenueLayout,
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
        if (resolvedId && currentStep >= 2 && !skipVenueLayout) {
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
      rooms,
      scheduleType,
      skipVenueLayout,
      startDate,
      startTime,
      supabase,
    ]
  )

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
    setCityQuadrant(blueprint.quadrant)
  }

  function handleBaselineTableLengthChange(ft: LayoutBaselineTableLengthFt) {
    setRooms((prev) => updateRoomInList(prev, activeRoomId, { baseline_table_length_ft: ft }))
  }

  function validateStep1(): boolean {
    if (!name.trim()) {
      toast.error('Event name is required')
      return false
    }
    const bounds = resolveScheduleBounds()
    if (!bounds) {
      toast.error('Complete schedule dates and times before continuing')
      return false
    }
    return true
  }

  function validateStep2(): boolean {
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
      if (currentStep === 1) {
        if (!validateStep1()) return
        const result = await autosave()
        if (!result.ok) {
          toast.error('Could not save draft — check schedule fields')
          return
        }
        setCurrentStep(2)
        return
      }
      if (currentStep === 2) {
        if (!validateStep2()) return
        const result = await autosave()
        if (!result.ok) {
          toast.error('Could not save venue — try again')
          return
        }
        setCurrentStep(3)
        return
      }
      if (currentStep === 3) {
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
        setCurrentStep(4)
        return
      }
      if (currentStep === 4) {
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
    if (currentStep > 1) setCurrentStep((s) => (s - 1) as WizardStep)
  }

  useEffect(() => {
    if (skipVenueLayout && currentStep === 4) {
      setCurrentStep(3)
    }
  }, [skipVenueLayout, currentStep])

  useEffect(() => {
    if (currentStep === 4 && !eventId) {
      setCurrentStep(3)
      toast.error('Save event details before opening the canvas')
    }
  }, [currentStep, eventId])

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className={WIZARD_PAGE_KICKER}>
          Market Setup Wizard · Step {currentStep} of {totalSteps}
        </p>
        <h1 className={WIZARD_PAGE_TITLE}>
          {existing ? 'Edit Market' : 'Create New Market'}
        </h1>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className={WIZARD_PANEL + ' flex-1 min-w-0 p-4 sm:p-5 space-y-4'}>
          {currentStep >= 2 && !skipVenueLayout ? (
            <LayoutRoomBar
              rooms={rooms}
              activeRoomId={activeRoomId}
              onSelectRoom={handleSelectRoom}
              onAddRoom={handleAddRoom}
              onRenameRoom={handleRenameRoom}
              onDeleteRoom={handleDeleteRoom}
            />
          ) : null}

          {currentStep === 1 ? (
            <>
              <WizardStepEventDetails
                name={name}
                onNameChange={setName}
                description={description}
                onDescriptionChange={setDescription}
                scheduleType={scheduleType}
                onScheduleTypeChange={setScheduleType}
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
                onListingTypeChange={setListingType}
                requireFullAttendance={requireFullAttendance}
                onRequireFullAttendanceChange={setRequireFullAttendance}
                allowMlm={allowMlm}
                onAllowMlmChange={setAllowMlm}
                boothClearancePolicy={boothClearancePolicy}
                onBoothClearancePolicyChange={setBoothClearancePolicy}
                raffleDonationRequirement={raffleDonationRequirement}
                onRaffleDonationRequirementChange={setRaffleDonationRequirement}
                coverImageUrl={coverImageUrl}
                onCoverChange={(file) => {
                  setCoverFile(file)
                  setCoverImageUrl(URL.createObjectURL(file))
                }}
              />
              <WizardNav step={1} onNext={goNext} nextDisabled={transitioning} />
            </>
          ) : null}

          {currentStep === 2 ? (
            <>
              <WizardStepVenueWithMapsProvider
                venuePresetId={venuePresetId}
                onVenuePresetChange={handleVenuePresetChange}
                cityQuadrant={cityQuadrant}
                onCityQuadrantChange={setCityQuadrant}
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
              />
              <WizardNav step={2} onBack={goBack} onNext={goNext} nextDisabled={transitioning} />
            </>
          ) : null}

          {currentStep === 3 ? (
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
                step={3}
                onBack={goBack}
                onNext={goNext}
                nextDisabled={transitioning}
                nextLabel={skipVenueLayout ? 'Save & deploy market' : undefined}
              />
            </>
          ) : null}

          {currentStep === 4 && eventId && !skipVenueLayout ? (
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
                onOverlapChange={setPlannerOverlap}
                onLiveQaChange={({ qaRunning }) => setPlannerQaRunning(qaRunning)}
              />
              <WizardNav step={4} onBack={goBack} onNext={goNext} nextDisabled={transitioning || plannerOverlap} />
            </>
          ) : null}
        </div>

        <WizardSummaryRail
          eventName={name.trim() || null}
          scheduleSummary={scheduleSummary}
          selectedVenue={selectedVenue}
          capacityLabel={summaryCapacityLabel}
          tableSizeLabel={currentStep >= 3 && !skipVenueLayout ? `Table size: ${baselineTableLengthFt} ft` : null}
          autosaveStatus={autosaveStatus}
        />
      </div>

      <WizardCritiqueDrawer findings={findings} onDismiss={dismiss} />
    </div>
  )
}
