import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getMarketPatronCheckIn,
  resolvePassportVendorsRequired,
} from '@/lib/market-passport/check-in'
import {
  parsePassportScanPayload,
  verifyPassportScanToken,
} from '@/lib/market-passport/scan-token'
import type { PassportScan } from '@/types/database'

export interface PassportProgress {
  scannedCount: number
  vendorsRequired: number
  bonusEligible: boolean
  scannedVendorIds: string[]
}

export async function getPassportProgress(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
  vendorsRequired: number
): Promise<PassportProgress> {
  const { data: scans } = await supabase
    .from('passport_scans')
    .select('vendor_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)

  const scannedVendorIds = (scans ?? []).map((row) => row.vendor_id as string)
  const scannedCount = scannedVendorIds.length
  const required = resolvePassportVendorsRequired(vendorsRequired)

  return {
    scannedCount,
    vendorsRequired: required,
    bonusEligible: scannedCount >= required,
    scannedVendorIds,
  }
}

export async function recordPassportScan(
  supabase: SupabaseClient,
  input: {
    userId: string
    token?: string
    vendorId?: string
    eventId?: string
  }
): Promise<
  | {
      ok: true
      scan: PassportScan
      alreadyScanned: boolean
      progress: PassportProgress
      vendorName: string | null
    }
  | { ok: false; error: string; status: number }
> {
  let eventId = input.eventId
  let vendorId = input.vendorId

  if (input.token) {
    const rawToken = parsePassportScanPayload(input.token)
    if (!rawToken) {
      return { ok: false, error: 'Invalid passport QR code.', status: 400 }
    }
    const parsed = verifyPassportScanToken(rawToken)
    if (!parsed) {
      return { ok: false, error: 'Passport QR code could not be verified.', status: 400 }
    }
    eventId = parsed.eventId
    vendorId = parsed.vendorId
  }

  if (!eventId || !vendorId) {
    return { ok: false, error: 'Vendor and market are required.', status: 400 }
  }

  const checkIn = await getMarketPatronCheckIn(supabase, eventId, input.userId)
  if (!checkIn) {
    return {
      ok: false,
      error: 'Check in at the market first to start your passport.',
      status: 403,
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, status, passport_vendors_required')
    .eq('id', eventId)
    .maybeSingle()

  if (!event) {
    return { ok: false, error: 'Market not found.', status: 404 }
  }

  if (!['published', 'active', 'completed'].includes(event.status)) {
    return { ok: false, error: 'This market is not open for passport scans.', status: 422 }
  }

  const { data: application } = await supabase
    .from('booth_applications')
    .select('id, vendor_id')
    .eq('event_id', eventId)
    .eq('vendor_id', vendorId)
    .eq('status', 'approved')
    .maybeSingle()

  if (!application) {
    return {
      ok: false,
      error: 'This vendor is not participating at this market.',
      status: 422,
    }
  }

  const { data: existing } = await supabase
    .from('passport_scans')
    .select('*')
    .eq('event_id', eventId)
    .eq('user_id', input.userId)
    .eq('vendor_id', vendorId)
    .maybeSingle()

  if (existing) {
    const progress = await getPassportProgress(
      supabase,
      eventId,
      input.userId,
      event.passport_vendors_required
    )
    const vendorName = await resolveVendorDisplayName(supabase, vendorId)
    return {
      ok: true,
      scan: existing as PassportScan,
      alreadyScanned: true,
      progress,
      vendorName,
    }
  }

  const { data: scan, error } = await supabase
    .from('passport_scans')
    .insert({
      event_id: eventId,
      user_id: input.userId,
      vendor_id: vendorId,
    })
    .select('*')
    .single()

  if (error || !scan) {
    return {
      ok: false,
      error: error?.message ?? 'Could not record passport scan',
      status: 422,
    }
  }

  const progress = await getPassportProgress(
    supabase,
    eventId,
    input.userId,
    event.passport_vendors_required
  )
  const vendorName = await resolveVendorDisplayName(supabase, vendorId)

  return {
    ok: true,
    scan: scan as PassportScan,
    alreadyScanned: false,
    progress,
    vendorName,
  }
}

async function resolveVendorDisplayName(
  supabase: SupabaseClient,
  vendorId: string
): Promise<string | null> {
  const { data: passport } = await supabase
    .from('vendor_passports')
    .select('business_name')
    .eq('user_id', vendorId)
    .maybeSingle()

  if (passport?.business_name) return passport.business_name

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', vendorId)
    .maybeSingle()

  return profile?.full_name ?? null
}
