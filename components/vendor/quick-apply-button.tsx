'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { Loader2, Zap } from 'lucide-react'
import { ApplyButton } from '@/components/events/apply-button'
import { resolveEventScheduleDays, daySelectionKey } from '@/lib/events/event-schedule-days'
import { parseAvailableSlots } from '@/lib/queries/event-capacity'
import { categoryRequiresDocumentation } from '@/lib/categories/regulated-categories'
import { evaluateQuickApplyEligibility } from '@/lib/vendor/quick-apply-eligibility'
import { readVendorApplyDefaults, writeVendorApplyDefaults } from '@/lib/vendor/apply-defaults'
import { triggerSuccessHaptic } from '@/lib/mobile/haptics'
import { hasExistingVendorApplication } from '@/lib/vendor/application-status-ui'
import type { ApplicationStatus, Event, EventCategoryLimit, PaymentMethod } from '@/types/database'
import type { CategorySlotInfo } from '@/lib/vendor/application-category-match'

interface QuickApplyButtonProps {
  event: Event
  userId: string
  applicationStatus?: ApplicationStatus | null
  applicationId?: string | null
  applicationsOpen?: boolean
  compact?: boolean
}

export function QuickApplyButton({
  event,
  userId,
  applicationStatus = null,
  applicationId = null,
  applicationsOpen = true,
  compact = false,
}: QuickApplyButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()
  const [slots, setSlots] = useState<CategorySlotInfo[]>([])
  const [passport, setPassport] = useState<{
    business_name: string | null
    primary_category_id: string | null
    category_ids: string[] | null
  } | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [showFullApply, setShowFullApply] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const { data: passportRow } = await supabase
        .from('vendor_passports')
        .select('business_name, primary_category_id, category_ids')
        .eq('user_id', userId)
        .maybeSingle()

      const limits = (event.category_limits ?? []) as EventCategoryLimit[]
      const categoryIds = limits.map((cl) => cl.category_id)
      const { data: categoryMeta } = categoryIds.length
        ? await supabase
            .from('categories')
            .select('id, name, requires_documentation')
            .in('id', categoryIds)
        : { data: [] }

      const metaById = Object.fromEntries((categoryMeta ?? []).map((row) => [row.id, row]))
      const slotRows = await Promise.all(
        limits
          .filter((cl) => event.allow_mlm || !cl.category?.is_mlm)
          .map(async (cl) => {
            const { data } = await supabase.rpc('get_available_slots', {
              p_event_id: event.id,
              p_category_id: cl.category_id,
            })
            const meta = metaById[cl.category_id]
            return {
              categoryId: cl.category_id,
              categoryName: cl.category?.name ?? meta?.name ?? 'Unknown',
              maxSlots: cl.max_slots,
              availableSlots: parseAvailableSlots(data),
              pricePerBooth: cl.price_per_booth,
              requiresDocumentation: categoryRequiresDocumentation(
                meta ?? { name: cl.category?.name ?? '', requires_documentation: false }
              ),
            } satisfies CategorySlotInfo
          })
      )

      if (cancelled) return
      setPassport(passportRow)
      setSlots(slotRows.sort((a, b) => a.categoryName.localeCompare(b.categoryName)))
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [event, supabase, userId])

  const eligibility = useMemo(() => {
    if (!loaded) return null
    return evaluateQuickApplyEligibility({
      event,
      applicationsOpen,
      passport: passport as Parameters<typeof evaluateQuickApplyEligibility>[0]['passport'],
      slots,
    })
  }, [applicationsOpen, event, loaded, passport, slots])

  const runQuickApply = useCallback(() => {
    if (hasExistingVendorApplication(applicationStatus)) {
      toast.error('You already have an application for this market.')
      return
    }

    startTransition(async () => {
      const scheduleDays = resolveEventScheduleDays(event)
      const requireFull = event.require_full_attendance ?? true
      const attendingEventDayIds = requireFull
        ? scheduleDays.map((day) => day.dayId).filter(Boolean) as string[]
        : scheduleDays.length === 1
          ? scheduleDays.map((day) => day.dayId).filter(Boolean) as string[]
          : []
      const attendingDates = requireFull
        ? scheduleDays.map((day) => day.date)
        : scheduleDays.length === 1
          ? [scheduleDays[0].date]
          : []

      if (!requireFull && attendingEventDayIds.length === 0 && scheduleDays.length > 1) {
        setShowFullApply(true)
        return
      }

      const defaults = readVendorApplyDefaults(userId)
      const paymentMethod: PaymentMethod = defaults.paymentMethod ?? 'SQUARE'

      const res = await fetch('/api/vendor/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          express: true,
          joinWaitlist: false,
          attendanceTermsAcknowledged: true,
          attendingEventDayIds,
          attendingDates,
          paymentMethod,
          tableCount: 1,
        }),
      })

      const data = (await res.json()) as {
        error?: string
        requiresWaitlist?: boolean
        application?: { status: ApplicationStatus }
        waitlisted?: boolean
      }

      if (!res.ok) {
        if (res.status === 409 && data.requiresWaitlist) {
          setShowFullApply(true)
          return
        }
        toast.error(data.error ?? 'Could not apply — open full form to continue.')
        setShowFullApply(true)
        return
      }

      writeVendorApplyDefaults(userId, { paymentMethod, termsAcknowledged: true })
      void triggerSuccessHaptic()

      if (data.waitlisted) {
        toast.success('Added to the waitlist — we will notify you if a spot opens.')
      } else if (event.booking_mode === 'instant') {
        toast.success('Application approved! Check Applications for payment steps.')
      } else {
        toast.success('Application submitted for review.')
      }

      router.refresh()
    })
  }, [applicationStatus, event, router, userId])

  if (hasExistingVendorApplication(applicationStatus)) {
    return (
      <ApplyButton
        event={event}
        userId={userId}
        applicationStatus={applicationStatus}
        applicationId={applicationId}
        applicationsOpen={applicationsOpen}
      />
    )
  }

  if (!applicationsOpen) {
    return (
      <Button size={compact ? 'sm' : 'default'} disabled className="min-h-11 w-full touch-manipulation">
        Applications closed
      </Button>
    )
  }

  if (!loaded || eligibility === null) {
    return (
      <Button size={compact ? 'sm' : 'default'} disabled className="min-h-11 w-full touch-manipulation">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Loading…
      </Button>
    )
  }

  if (!eligibility.eligible || showFullApply) {
    return (
      <ApplyButton
        event={event}
        userId={userId}
        applicationStatus={applicationStatus}
        applicationId={applicationId}
        applicationsOpen={applicationsOpen}
      />
    )
  }

  const label =
    eligibility.reason === 'instant'
      ? compact
        ? 'Apply now'
        : 'Apply in one tap'
      : compact
        ? 'Apply'
        : 'Quick apply'

  return (
    <Button
      type="button"
      size={compact ? 'sm' : 'default'}
      className="min-h-11 w-full touch-manipulation gap-1.5"
      disabled={pending}
      onClick={runQuickApply}
      data-quick-apply-event={event.id}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : eligibility.reason === 'instant' ? (
        <Zap className="h-4 w-4" aria-hidden />
      ) : null}
      {label}
    </Button>
  )
}

/** Auto-trigger quick apply when landing from a push deep link (?apply=1). */
export function VendorEventApplyDeepLink({ eventId }: { eventId: string }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('apply') !== '1') return
    params.delete('apply')
    const next = params.toString()
    router.replace(`/vendor/events/${eventId}${next ? `?${next}` : ''}`, { scroll: false })
    const btn = document.querySelector<HTMLButtonElement>(`[data-quick-apply-event="${eventId}"]`)
    btn?.click()
  }, [eventId, router])

  return null
}
