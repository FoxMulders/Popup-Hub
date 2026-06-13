import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  buildDiverseSeedApplicationSlots,
  resolveSeedTargetTableCount,
  type SeedVenueProfile,
} from '@/lib/booth-planner/seed-vendor-applications'

export const TEST_SUITE_EMAIL_DOMAIN = 'popuphub.seed'

export interface TestSuiteCategoryLimit {
  category_id: string
  category_name: string
  max_slots: number
}

export interface PersistTestSuiteInput {
  /** Service-role Supabase client (bypasses RLS) — use `createAdminClient()`. */
  supabase: SupabaseClient
  authAdmin: SupabaseClient['auth']['admin']
  eventId: string
  coordinatorId: string
  maxBoothCapacity: number
  layoutCapacity?: number
  venuePresetId?: string | null
  roomName?: string | null
  categoryLimits: TestSuiteCategoryLimit[]
}

export interface TestSuiteApplicationRecord {
  id: string
  vendorId: string
  vendorName: string
  categoryName: string
  categoryId: string
  tableCount: number
  requestedBoothType: 'inside' | 'power'
}

export interface PersistTestSuiteResult {
  vendorCount: number
  applicationCount: number
  tableSlots: number
  skippedForCapacity: number
  applications: TestSuiteApplicationRecord[]
}

interface VendorGroup {
  seedGroupId: string
  vendorName: string
  categoryName: string
  tableCount: number
  requestedBoothType: 'inside' | 'power'
  serial: number
}

function testSuiteEmail(eventId: string, serial: number): string {
  return `testsuite-${eventId.slice(0, 8)}-${serial}@${TEST_SUITE_EMAIL_DOMAIN}`
}

function resolveCategoryId(
  categoryName: string,
  limits: TestSuiteCategoryLimit[],
  categoriesByName: Map<string, string>
): string | null {
  const normalized = categoryName.trim().toLowerCase()
  const fromLimit = limits.find((l) => l.category_name.trim().toLowerCase() === normalized)
  if (fromLimit) return fromLimit.category_id
  return categoriesByName.get(normalized) ?? limits[0]?.category_id ?? null
}

function groupSlotsForVendors(
  targetTableCount: number,
  limits: TestSuiteCategoryLimit[],
  categoriesByName: Map<string, string>
): { groups: VendorGroup[]; skipped: number } {
  const slots = buildDiverseSeedApplicationSlots(targetTableCount)
  const byGroup = new Map<string, typeof slots>()
  const groupOrder: string[] = []

  for (const slot of slots) {
    if (!byGroup.has(slot.seedGroupId)) {
      byGroup.set(slot.seedGroupId, [])
      groupOrder.push(slot.seedGroupId)
    }
    byGroup.get(slot.seedGroupId)!.push(slot)
  }

  const remainingByCategory = new Map<string, number>()
  for (const limit of limits) {
    remainingByCategory.set(limit.category_id, Math.max(0, limit.max_slots))
  }

  const groups: VendorGroup[] = []
  let skipped = 0
  let serial = 0

  for (const groupId of groupOrder) {
    const members = byGroup.get(groupId)!
    members.sort((a, b) => a.slotIndex - b.slotIndex)
    const lead = members[0]!
    const tableCount = lead.slotCount ?? members.length
    const categoryId = resolveCategoryId(lead.categoryName, limits, categoriesByName)
    if (!categoryId) {
      skipped += 1
      continue
    }

    const remaining = remainingByCategory.get(categoryId) ?? 0
    if (remaining <= 0) {
      skipped += 1
      continue
    }

    remainingByCategory.set(categoryId, remaining - 1)
    serial += 1
    groups.push({
      seedGroupId: groupId,
      vendorName: lead.vendorName,
      categoryName: lead.categoryName,
      tableCount,
      requestedBoothType: lead.requestedBoothType,
      serial,
    })
  }

  return { groups, skipped }
}

async function findAuthUserByEmail(
  authAdmin: SupabaseClient['auth']['admin'],
  email: string
): Promise<User | null> {
  let page = 1
  const perPage = 200
  const needle = email.toLowerCase()

  while (true) {
    const { data, error } = await authAdmin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((user) => user.email?.toLowerCase() === needle)
    if (match) return match
    if (data.users.length < perPage) break
    page += 1
  }

  return null
}

async function upsertTestVendorUser(
  authAdmin: SupabaseClient['auth']['admin'],
  email: string,
  fullName: string
): Promise<string> {
  const existing = await findAuthUserByEmail(authAdmin, email)
  if (existing) {
    const { data, error } = await authAdmin.updateUserById(existing.id, {
      email,
      password: 'testing',
      email_confirm: true,
      user_metadata: { role: 'vendor', full_name: fullName },
    })
    if (error) throw new Error(`update ${email}: ${error.message}`)
    return data.user.id
  }

  const { data, error } = await authAdmin.createUser({
    email,
    password: 'testing',
    email_confirm: true,
    user_metadata: { role: 'vendor', full_name: fullName },
  })
  if (error) throw new Error(`create ${email}: ${error.message}`)
  return data.user.id
}

export async function clearTestSuiteApplications(
  supabase: SupabaseClient,
  eventId: string
): Promise<number> {
  const { data: apps } = await supabase
    .from('booth_applications')
    .select('id, vendor_id, vendor:profiles!booth_applications_vendor_id_fkey(email)')
    .eq('event_id', eventId)

  const testAppIds =
    apps
      ?.filter((row) => {
        const vendor = row.vendor as { email?: string } | { email?: string }[] | null
        const email = Array.isArray(vendor) ? vendor[0]?.email : vendor?.email
        return email?.toLowerCase().endsWith(`@${TEST_SUITE_EMAIL_DOMAIN}`)
      })
      .map((row) => row.id) ?? []

  if (testAppIds.length === 0) return 0

  const { error } = await supabase.from('booth_applications').delete().in('id', testAppIds)
  if (error) throw new Error(`clear test suite applications: ${error.message}`)
  return testAppIds.length
}

export async function persistTestSuiteApplications(
  input: PersistTestSuiteInput
): Promise<PersistTestSuiteResult> {
  const {
    supabase,
    authAdmin,
    eventId,
    coordinatorId,
    maxBoothCapacity,
    layoutCapacity,
    venuePresetId,
    roomName,
    categoryLimits,
  } = input

  if (categoryLimits.length === 0) {
    throw new Error('Add at least one category cap before populating the test suite.')
  }

  const { data: categories } = await supabase.from('categories').select('id, name')
  const categoriesByName = new Map(
    (categories ?? []).map((c) => [c.name.trim().toLowerCase(), c.id])
  )

  const limitsWithNames = categoryLimits.map((limit) => ({
    ...limit,
    category_name:
      limit.category_name ||
      categories?.find((c) => c.id === limit.category_id)?.name ||
      'Uncategorized',
  }))

  const targetTableCount = resolveSeedTargetTableCount({
    maxBoothCapacity,
    layoutCapacity,
    venuePresetId,
    roomName,
  })

  await clearTestSuiteApplications(supabase, eventId)

  const { groups, skipped } = groupSlotsForVendors(
    targetTableCount,
    limitsWithNames,
    categoriesByName
  )
  const now = new Date().toISOString()
  const applications: TestSuiteApplicationRecord[] = []

  for (const group of groups) {
    const categoryId = resolveCategoryId(group.categoryName, limitsWithNames, categoriesByName)
    if (!categoryId) continue

    const email = testSuiteEmail(eventId, group.serial)
    const vendorId = await upsertTestVendorUser(authAdmin, email, group.vendorName)

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: vendorId,
        email,
        role: 'vendor',
        full_name: group.vendorName,
      },
      { onConflict: 'id' }
    )
    if (profileError) throw new Error(`profile ${email}: ${profileError.message}`)

    await supabase.from('wallets').upsert({ user_id: vendorId }, { onConflict: 'user_id' })

    const { error: passportError } = await supabase.from('vendor_passports').upsert(
      {
        user_id: vendorId,
        business_name: group.vendorName,
        primary_category_id: categoryId,
        category_ids: [categoryId],
        bio: 'Seeded test-suite vendor for coordinator QA.',
      },
      { onConflict: 'user_id' }
    )
    if (passportError) throw new Error(`passport ${email}: ${passportError.message}`)

    await supabase.from('coordinator_vendor_approvals').upsert(
      {
        coordinator_id: coordinatorId,
        vendor_user_id: vendorId,
      },
      { onConflict: 'coordinator_id,vendor_user_id' }
    )

    const { data: application, error: applicationError } = await supabase
      .from('booth_applications')
      .insert({
        event_id: eventId,
        vendor_id: vendorId,
        category_id: categoryId,
        status: 'approved',
        payment_status: 'paid',
        payment_method: 'CASH',
        application_payment_status: 'COMPLETED',
        table_count: group.tableCount,
        requested_booth_type: group.requestedBoothType,
        applied_at: now,
        approved_at: now,
        booth_number: null,
      })
      .select('id')
      .single()

    if (applicationError || !application) {
      throw new Error(applicationError?.message ?? `application ${email}`)
    }

    applications.push({
      id: application.id,
      vendorId,
      vendorName: group.vendorName,
      categoryName: group.categoryName,
      categoryId,
      tableCount: group.tableCount,
      requestedBoothType: group.requestedBoothType,
    })
  }

  const tableSlots = applications.reduce((sum, app) => sum + app.tableCount, 0)

  return {
    vendorCount: applications.length,
    applicationCount: applications.length,
    tableSlots,
    skippedForCapacity: skipped,
    applications,
  }
}

export function resolveTestSuiteVenueProfile(input: {
  venuePresetId?: string | null
  roomName?: string | null
}): SeedVenueProfile {
  const id = (input.venuePresetId ?? '').toLowerCase()
  const name = (input.roomName ?? '').toLowerCase()
  if (id.includes('kilkenny') || name.includes('kilkenny')) return 'kilkenny'
  if (name.includes('main hall') || id.includes('main')) return 'main_hall'
  return 'default'
}
