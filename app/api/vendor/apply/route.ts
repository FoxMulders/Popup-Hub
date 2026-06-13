import { NextResponse } from 'next/server'
import {
  buildBoothContractSnapshot,
  contractRequiresVendorAcknowledgment,
  resolveEventBoothContract,
} from '@/lib/booth-contract/resolve-event-contract'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getCoordinatorAccessToken } from '@/lib/square/oauth'
import {
  isEventOpenForApplications,
  OPEN_EVENT_STATUSES,
  VENDOR_APPLY_EVENT_SELECT,
} from '@/lib/queries/events'
import { fetchCategoryAvailableSlots } from '@/lib/queries/event-capacity'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'
import {
  evaluatePassportCategoryMatch,
  type CategorySlotInfo,
} from '@/lib/vendor/application-category-match'
import { resolvePassportCategoryIds } from '@/lib/vendor/passport-categories'
import {
  resolveEventScheduleDays,
  normalizeAttendanceSelection,
} from '@/lib/events/event-schedule-days'
import {
  buildMarketApplicationEmailFromEvent,
  sendMarketApplicationReceivedEmail,
} from '@/lib/email/application-received'
import {
  isOfflinePaymentMethod,
  isPaymentMethodAllowed,
  normalizeVendorCheckoutToPaymentMethod,
  resolveEnabledPaymentMethods,
  resolvePreferredDigitalPaymentMethod,
  resolvePaymentFieldsForPaidApplication,
} from '@/lib/applications/payment-fields'
import {
  etransferHoldExpiresAt,
  generateEtransferReferenceCode,
} from '@/lib/applications/etransfer-reference'
import { dispatchEtransferInstructions } from '@/lib/applications/etransfer-instructions-service'
import { isCategoryCapacityError } from '@/lib/applications/booth-payment-processing'
import { resolvePostApprovalStatus, isReservedBoothStatus } from '@/lib/applications/resolve-approval-status'
import { categoryRequiresDocumentation } from '@/lib/categories/regulated-categories'
import { coordinatorVendorApplyBlockReason } from '@/lib/coordinator/verification'
import { vendorApplyBlockReason } from '@/lib/vendor/verification'
import {
  computeApplicationBoothPriceCents,
  isCommunityMarketListing,
  normalizeTableCount,
} from '@/lib/monetization/booth-pricing'
import type { Role } from '@/types/database'
import { assertVendorCanApplyToCategory, claimBoothSlotForApplication } from '@/lib/engagement/booth-access'
import { requireVenueVerified } from '@/lib/venues/require-venue-verified'

async function nextWaitlistPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  categoryId: string
) {
  const { data } = await supabase
    .from('booth_applications')
    .select('waitlist_position')
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .eq('status', 'waitlisted')
    .order('waitlist_position', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.waitlist_position ?? 0) + 1
}

async function loadEventCategorySlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
  allowMlm: boolean
): Promise<CategorySlotInfo[]> {
  const { data: limits } = await supabase
    .from('event_category_limits')
    .select('category_id, max_slots, price_per_booth, category:categories(name, is_mlm, requires_documentation)')
    .eq('event_id', eventId)

  const eligible = (limits ?? []).filter((limit) => {
    const category = Array.isArray(limit.category) ? limit.category[0] : limit.category
    return allowMlm || !category?.is_mlm
  })

  return Promise.all(
    eligible.map(async (limit) => {
      const category = Array.isArray(limit.category) ? limit.category[0] : limit.category
      const availableSlots = await fetchCategoryAvailableSlots(
        supabase,
        eventId,
        limit.category_id
      )
      return {
        categoryId: limit.category_id,
        categoryName: category?.name ?? 'Unknown',
        maxSlots: limit.max_slots,
        availableSlots,
        pricePerBooth: limit.price_per_booth ?? 0,
        requiresDocumentation: categoryRequiresDocumentation(category ?? undefined),
      }
    })
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vendorId = user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, email')
    .eq('id', vendorId)
    .single()

  if ((profile?.role as Role | undefined) !== 'vendor') {
    return NextResponse.json({ error: 'Vendor account required' }, { status: 403 })
  }

  const body = (await request.json()) as {
    eventId?: string
    categoryId?: string
    neighborPreference?: string | null
    joinWaitlist?: boolean
    attendanceTermsAcknowledged?: boolean
    boothContractAcknowledged?: boolean
    boothContractSignatureMethod?: 'digital' | 'uploaded'
    boothContractSignedName?: string | null
    boothContractSignatureImageUrl?: string | null
    boothContractSignedDocumentUrl?: string | null
    attendingEventDayIds?: string[]
    attendingDates?: string[]
    paymentMethod?: 'SQUARE' | 'STRIPE' | 'ETRANSFER' | 'CASH' | 'credit_card' | 'etransfer' | 'cash'
    applicableDocumentationUrl?: string | null
    tableCount?: number
  }

  const {
    eventId,
    categoryId: requestedCategoryId,
    neighborPreference,
    joinWaitlist,
    attendanceTermsAcknowledged,
    boothContractAcknowledged,
    boothContractSignatureMethod,
    boothContractSignedName,
    boothContractSignatureImageUrl,
    boothContractSignedDocumentUrl,
    attendingEventDayIds,
    attendingDates,
    paymentMethod: rawPaymentMethod,
    applicableDocumentationUrl,
    tableCount: rawTableCount,
  } = body
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const serviceSupabase = await createServiceClient()

  const [{ data: passport }, { data: event, error: eventError }, { data: existing }] =
    await Promise.all([
      supabase
        .from('vendor_passports')
        .select(
          'id, business_name, primary_category_id, category_ids, is_verified, verification_status, business_number, social_handle, risk_score, account_status'
        )
        .eq('user_id', vendorId)
        .maybeSingle(),
      serviceSupabase
        .from('events')
        .select(VENDOR_APPLY_EVENT_SELECT)
        .eq('id', eventId)
        .maybeSingle(),
      supabase
        .from('booth_applications')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('vendor_id', vendorId)
        .maybeSingle(),
    ])

  if (eventError) {
    console.error('[vendor/apply] event query failed', {
      eventId,
      message: eventError.message,
      code: eventError.code,
    })
    return NextResponse.json({ error: 'Could not load market details' }, { status: 500 })
  }

  if (!isPassportReadyForApplication(passport)) {
    return NextResponse.json(
      { error: 'Complete your Vendor Passport before applying to markets.' },
      { status: 400 }
    )
  }

  const fraudBlock = vendorApplyBlockReason(passport)
  if (fraudBlock) {
    return NextResponse.json({ error: fraudBlock }, { status: 403 })
  }

  const { data: primaryCategory } = await supabase
    .from('categories')
    .select('id, name, is_broad')
    .eq('id', passport.primary_category_id)
    .maybeSingle()

  if (!primaryCategory || primaryCategory.is_broad !== true) {
    return NextResponse.json(
      {
        error:
          'Your Vendor Passport primary category is too specific. Edit your passport and pick a broader bucket (e.g. Artisan Crafts, Food & Beverage) before applying.',
      },
      { status: 400 }
    )
  }

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (!OPEN_EVENT_STATUSES.includes(event.status as (typeof OPEN_EVENT_STATUSES)[number])) {
    return NextResponse.json({ error: 'This market is not open for applications' }, { status: 400 })
  }

  if (!isEventOpenForApplications(event)) {
    return NextResponse.json({ error: 'Applications are closed for this market' }, { status: 400 })
  }

  const venueGate = requireVenueVerified(event)
  if (!venueGate.ok) {
    return NextResponse.json({ error: venueGate.reason }, { status: 403 })
  }

  const coordinatorProfile = Array.isArray(event.coordinator)
    ? event.coordinator[0]
    : event.coordinator
  const coordinatorBlock = coordinatorVendorApplyBlockReason(coordinatorProfile)
  if (coordinatorBlock) {
    return NextResponse.json({ error: coordinatorBlock }, { status: 403 })
  }

  if (existing) {
    return NextResponse.json(
      {
        error: 'You have already applied to this event',
        application: { id: existing.id, status: existing.status },
      },
      { status: 409 }
    )
  }

  if (!attendanceTermsAcknowledged) {
    return NextResponse.json(
      { error: 'You must agree to the attendance terms before submitting.' },
      { status: 400 }
    )
  }

  const boothContractRequired = contractRequiresVendorAcknowledgment(event)
  if (boothContractRequired && !boothContractAcknowledged) {
    return NextResponse.json(
      { error: 'You must sign the digital booth contract before submitting.' },
      { status: 400 }
    )
  }

  if (boothContractRequired) {
    if (boothContractSignatureMethod !== 'digital' && boothContractSignatureMethod !== 'uploaded') {
      return NextResponse.json(
        { error: 'Choose digital signature or upload a signed contract copy.' },
        { status: 400 }
      )
    }
    if (boothContractSignatureMethod === 'digital') {
      const signedName = boothContractSignedName?.trim() ?? ''
      if (!signedName) {
        return NextResponse.json({ error: 'Enter your full legal name to sign digitally.' }, { status: 400 })
      }
      if (!boothContractSignatureImageUrl?.trim()) {
        return NextResponse.json({ error: 'Draw your digital signature before submitting.' }, { status: 400 })
      }
    }
    if (boothContractSignatureMethod === 'uploaded' && !boothContractSignedDocumentUrl?.trim()) {
      return NextResponse.json(
        { error: 'Upload a scan or photo of your signed contract before submitting.' },
        { status: 400 }
      )
    }
  }

  const resolvedBoothContract = resolveEventBoothContract(event)
  const contractSignedAt = new Date().toISOString()
  const boothContractSnapshot =
    boothContractRequired
      ? buildBoothContractSnapshot({
          clauses: resolvedBoothContract.clauses,
          pdfUrl: resolvedBoothContract.pdfUrl,
          acknowledgedAt: contractSignedAt,
          signature: {
            method: boothContractSignatureMethod!,
            signedName:
              boothContractSignatureMethod === 'digital' ? boothContractSignedName?.trim() ?? null : null,
            signatureImageUrl:
              boothContractSignatureMethod === 'digital'
                ? boothContractSignatureImageUrl?.trim() ?? null
                : null,
            signedDocumentUrl:
              boothContractSignatureMethod === 'uploaded'
                ? boothContractSignedDocumentUrl?.trim() ?? null
                : null,
            signedAt: contractSignedAt,
          },
        })
      : null

  const scheduleDays = resolveEventScheduleDays(event)
  const attendanceSelection = normalizeAttendanceSelection(
    scheduleDays,
    event.require_full_attendance ?? true,
    { attendingEventDayIds, attendingDates }
  )

  if ('error' in attendanceSelection) {
    return NextResponse.json({ error: attendanceSelection.error }, { status: 400 })
  }

  const selectedAttendanceEventDayIds = attendanceSelection.attendingEventDayIds
  const selectedAttendanceDates = attendanceSelection.attendingDates

  const eventSlots = await loadEventCategorySlots(supabase, eventId, !!event.allow_mlm)
  const match = evaluatePassportCategoryMatch(passport, eventSlots)

  if (match.passportSlots.length === 0) {
    return NextResponse.json(
      {
        error:
          'None of your passport categories are offered at this market. Update your passport or choose another event.',
      },
      { status: 400 }
    )
  }

  const passportCategoryIds = resolvePassportCategoryIds(passport)
  if (requestedCategoryId && !passportCategoryIds.includes(requestedCategoryId)) {
    return NextResponse.json(
      { error: 'Selected category is not on your Vendor Passport.' },
      { status: 400 }
    )
  }

  const categoryId = match.allCategoriesFull
    ? match.waitlistCategoryId
    : requestedCategoryId ?? match.resolvedCategoryId

  if (!categoryId) {
    return NextResponse.json({ error: 'Could not resolve an application category.' }, { status: 400 })
  }

  const boothAccess = await assertVendorCanApplyToCategory(serviceSupabase, {
    event,
    vendorId,
    categoryId,
  })
  if (!boothAccess.ok) {
    return NextResponse.json({ error: boothAccess.reason }, { status: 403 })
  }

  const { data: categoryLimit } = await supabase
    .from('event_category_limits')
    .select('price_per_booth, category:categories(is_mlm, name)')
    .eq('event_id', eventId)
    .eq('category_id', categoryId)
    .maybeSingle()

  if (!categoryLimit) {
    return NextResponse.json({ error: 'Invalid category for this market' }, { status: 400 })
  }

  const category = Array.isArray(categoryLimit.category)
    ? categoryLimit.category[0]
    : categoryLimit.category

  if (category?.is_mlm && !event.allow_mlm) {
    return NextResponse.json({ error: 'This category is not available for this market' }, { status: 400 })
  }

  if (categoryRequiresDocumentation(category ?? undefined) && !applicableDocumentationUrl?.trim()) {
    return NextResponse.json(
      { error: 'Please upload required permits/documentation for this vendor category.' },
      { status: 400 },
    )
  }

  const availableSlots = await fetchCategoryAvailableSlots(supabase, eventId, categoryId)
  const categoryIsFull = availableSlots <= 0

  if (match.allCategoriesFull && !joinWaitlist) {
    return NextResponse.json(
      {
        error:
          'All of your passport categories are full at this market. Confirm waitlist to be notified if a spot opens.',
        requiresWaitlist: true,
      },
      { status: 409 }
    )
  }

  if (categoryIsFull && !joinWaitlist && !match.allCategoriesFull) {
    return NextResponse.json(
      {
        error: 'This category is full. Confirm waitlist to be notified if a spot opens.',
        requiresWaitlist: true,
      },
      { status: 409 }
    )
  }

  const isInstant = event.booking_mode === 'instant'
  const tableCount = isCommunityMarketListing(event.listing_type)
    ? normalizeTableCount(rawTableCount)
    : 1
  const boothPrice = computeApplicationBoothPriceCents(
    categoryLimit.price_per_booth,
    {
      listing_type: event.listing_type,
      booth_price_cents: event.booth_price_cents,
      multi_table_discount_percent: event.multi_table_discount_percent,
    },
    tableCount
  )
  const requiresPayment = boothPrice > 0
  const coordinator = Array.isArray(event.coordinator) ? event.coordinator[0] : event.coordinator

  let paymentMethod = resolvePreferredDigitalPaymentMethod(['SQUARE'])

  if (requiresPayment) {
    const credentials = await getCoordinatorAccessToken(
      serviceSupabase,
      event.coordinator_id as string
    )
    const squareReady =
      !!event.square_merchant_id ||
      (!!credentials?.accessToken && !!credentials.merchantId)
    const stripeReady =
      !!coordinator?.stripe_connected_id && coordinator?.stripe_onboarding_complete === true

    const enabled = resolveEnabledPaymentMethods(event, {
      squareConnected: squareReady,
      stripeConnected: stripeReady,
    })
    paymentMethod = normalizeVendorCheckoutToPaymentMethod(rawPaymentMethod, enabled)

    if (
      !isPaymentMethodAllowed(paymentMethod, event, {
        squareConnected: squareReady,
        stripeConnected: stripeReady,
      })
    ) {
      return NextResponse.json(
        { error: 'Selected payment method is not available for this market' },
        { status: 422 }
      )
    }

    if (paymentMethod === 'SQUARE' && !squareReady) {
      return NextResponse.json(
        { error: 'Coordinator has not connected Square for paid booths yet' },
        { status: 422 }
      )
    }

    if (paymentMethod === 'STRIPE' && !stripeReady) {
      return NextResponse.json(
        { error: 'Coordinator has not connected Stripe for paid booths yet' },
        { status: 422 }
      )
    }
  }

  let status: 'pending' | 'approved' | 'waitlisted' | 'pending_insurance' = 'pending'
  let waitlistPosition: number | null = null
  const now = new Date().toISOString()

  if (categoryIsFull || match.allCategoriesFull) {
    status = 'waitlisted'
    waitlistPosition = await nextWaitlistPosition(supabase, eventId, categoryId)
  } else if (isInstant) {
    const freshAvailable = await fetchCategoryAvailableSlots(supabase, eventId, categoryId)
    if (freshAvailable <= 0) {
      if (joinWaitlist) {
        status = 'waitlisted'
        waitlistPosition = await nextWaitlistPosition(supabase, eventId, categoryId)
      } else {
        return NextResponse.json(
          {
            error: 'This category is full. Confirm waitlist to be notified if a spot opens.',
            requiresWaitlist: true,
          },
          { status: 409 }
        )
      }
    } else {
      status = resolvePostApprovalStatus(event.market_insurance_required)
    }
  }

  /*
   * E-Transfer hard gate: even on instant-approval markets, vendors
   * who pick Interac e-Transfer must NOT auto-approve. Their booth
   * stays in the Pending Review / Awaiting Funds Verification queue
   * until the coordinator clicks "Mark as Paid". This prevents an
   * unpaid vendor from showing up in the Approved pool and on the
   * floor-plan layout grid before the cash has actually arrived.
   *
   * SQUARE applications keep their existing post-approval payment
   * flow (vendor pays with card after approval), since Square clears
   * funds atomically inside the tokenization handshake.
   */
  if (
    isOfflinePaymentMethod(paymentMethod) &&
    (status === 'approved' || status === 'pending_insurance')
  ) {
    status = 'pending'
    waitlistPosition = null
  }

  const paymentApproved = status === 'approved'
  const paymentFields = resolvePaymentFieldsForPaidApplication({
    paymentMethod,
    requiresPayment,
    approved: paymentApproved,
  })

  const hasCategoryOverflow = match.hasCategoryOverflow && !match.allCategoriesFull
  const offlinePending =
    isOfflinePaymentMethod(paymentMethod) &&
    paymentFields.application_payment_status === 'PENDING_REVIEW'
  const etransferReferenceCode =
    offlinePending && paymentMethod === 'ETRANSFER' ? generateEtransferReferenceCode() : null
  const etransferExpiresAt =
    offlinePending && paymentMethod === 'ETRANSFER' ? etransferHoldExpiresAt() : null

  async function insertApplication() {
    return supabase
      .from('booth_applications')
      .insert({
        event_id: eventId,
        vendor_id: vendorId,
        category_id: categoryId,
        status,
        payment_status: paymentFields.payment_status,
        payment_method: paymentFields.payment_method,
        application_payment_status: paymentFields.application_payment_status,
        etransfer_reference_code: etransferReferenceCode,
        etransfer_expires_at: etransferExpiresAt,
        neighbor_preference: neighborPreference?.trim() || null,
        waitlist_position: waitlistPosition,
        has_category_overflow: hasCategoryOverflow,
        overflow_category_names: hasCategoryOverflow ? match.fullCategoryNames : [],
        attending_event_day_ids: selectedAttendanceEventDayIds,
        attending_dates: selectedAttendanceDates,
        attendance_terms_acknowledged_at: now,
        booth_contract_acknowledged_at: boothContractSnapshot ? now : null,
        booth_contract_snapshot: boothContractSnapshot,
        booth_contract_signed_at: boothContractSnapshot?.signed_at ?? null,
        booth_contract_signature_method: boothContractSnapshot?.signature_method ?? null,
        applicable_documentation_url: applicableDocumentationUrl?.trim() || null,
        table_count: tableCount,
        ...(isReservedBoothStatus(status) ? { approved_at: now } : {}),
      })
      .select(
        'id, status, payment_status, payment_method, application_payment_status, waitlist_position, has_category_overflow, overflow_category_names, attending_dates'
      )
      .single()
  }

  let { data: inserted, error } = await insertApplication()

  if (error && isCategoryCapacityError(error) && (status === 'approved' || status === 'pending_insurance')) {
    if (joinWaitlist) {
      status = 'waitlisted'
      waitlistPosition = await nextWaitlistPosition(supabase, eventId, categoryId)
      const waitlistedPaymentFields = resolvePaymentFieldsForPaidApplication({
        paymentMethod,
        requiresPayment,
        approved: false,
      })
      Object.assign(paymentFields, waitlistedPaymentFields)

      ;({ data: inserted, error } = await supabase
        .from('booth_applications')
        .insert({
          event_id: eventId,
          vendor_id: vendorId,
          category_id: categoryId,
          status: 'waitlisted',
          payment_status: waitlistedPaymentFields.payment_status,
          payment_method: waitlistedPaymentFields.payment_method,
          application_payment_status: waitlistedPaymentFields.application_payment_status,
          etransfer_reference_code: null,
          etransfer_expires_at: null,
          neighbor_preference: neighborPreference?.trim() || null,
          waitlist_position: waitlistPosition,
          has_category_overflow: hasCategoryOverflow,
          overflow_category_names: hasCategoryOverflow ? match.fullCategoryNames : [],
          attending_event_day_ids: selectedAttendanceEventDayIds,
          attending_dates: selectedAttendanceDates,
          attendance_terms_acknowledged_at: now,
          booth_contract_acknowledged_at: boothContractSnapshot ? now : null,
          booth_contract_snapshot: boothContractSnapshot,
          booth_contract_signed_at: boothContractSnapshot?.signed_at ?? null,
          booth_contract_signature_method: boothContractSnapshot?.signature_method ?? null,
          table_count: tableCount,
        })
        .select(
          'id, status, payment_status, payment_method, application_payment_status, waitlist_position, has_category_overflow, overflow_category_names, attending_dates'
        )
        .single())
    } else {
      return NextResponse.json(
        {
          error: 'This category is full. Confirm waitlist to be notified if a spot opens.',
          requiresWaitlist: true,
        },
        { status: 409 }
      )
    }
  }

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already applied to this event' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (inserted?.id && boothAccess.phase !== 'none') {
    await claimBoothSlotForApplication(serviceSupabase, {
      eventId,
      categoryId,
      applicationId: inserted.id,
      vendorId,
    })
  }

  try {
    await sendMarketApplicationReceivedEmail(
      buildMarketApplicationEmailFromEvent({
        vendorEmail: user.email ?? profile?.email ?? '',
        passport,
        profile,
        event: {
          name: event.name,
          start_at: event.start_at,
          end_at: event.end_at,
          is_multi_day: event.is_multi_day,
          event_days: event.event_days,
          coordinator: event.coordinator,
        },
      })
    )
  } catch (emailErr) {
    console.error('[email] market application received unexpected error:', emailErr, {
      eventId,
      vendorId,
    })
  }

  if (
    inserted?.id &&
    boothContractSnapshot?.signature_method === 'uploaded' &&
    event.coordinator_id
  ) {
    await serviceSupabase.from('notifications').insert({
      user_id: event.coordinator_id,
      type: 'application_follow_up',
      message: `A vendor uploaded a signed booth contract for "${event.name}". Review the signed copy in their application.`,
      metadata: {
        event_id: eventId,
        application_id: inserted.id,
        vendor_id: vendorId,
      },
    })
  }

  if (offlinePending && paymentMethod === 'ETRANSFER' && inserted?.id && requiresPayment) {
    dispatchEtransferInstructions(serviceSupabase, {
      applicationId: inserted.id,
      eventId,
      vendorId,
      boothPriceCents: boothPrice,
      referenceCode: etransferReferenceCode,
      expiresAt: etransferExpiresAt,
    }).catch((err) => {
      console.error('[etransfer] instruction email failed:', err, {
        applicationId: inserted.id,
      })
    })
  }

  return NextResponse.json({
    ok: true,
    application: inserted,
    requiresPayment:
      requiresPayment &&
      paymentApproved &&
      paymentMethod === 'SQUARE' &&
      paymentFields.payment_status === 'payment_required',
    paymentMethod: paymentFields.payment_method,
    paymentStatus: paymentFields.application_payment_status,
    boothPriceCents: boothPrice,
    waitlisted: status === 'waitlisted',
    hasCategoryOverflow,
    eTransferPendingReview:
      paymentMethod === 'ETRANSFER' &&
      paymentFields.application_payment_status === 'PENDING_REVIEW',
  })
}
