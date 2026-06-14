import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  DIVERSE_SEED_TEMPLATES,
  resolveSeedVenueProfile,
  SEED_TABLE_CEILINGS,
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
  categoryId: string
  tableCount: number
  requestedBoothType: 'inside' | 'power'
  serial: number
}

function testSuiteEmail(eventId: string, serial: number): string {
  return `testsuite-${eventId.slice(0, 8)}-${serial}@${TEST_SUITE_EMAIL_DOMAIN}`
}

/** Vendor application slots from category caps — not physical layout table count. */
export function resolveTestSuiteTargetVendorCount(input: {
  maxBoothCapacity: number
  venuePresetId?: string | null
  roomName?: string | null
}): number {
  const profile = resolveSeedVenueProfile(input)
  const ceiling =
    profile === 'kilkenny'
      ? SEED_TABLE_CEILINGS.kilkenny
      : profile === 'main_hall'
        ? SEED_TABLE_CEILINGS.main_hall
        : input.maxBoothCapacity
  return Math.max(0, Math.min(input.maxBoothCapacity, ceiling))
}

/** Round-robin category slots so seed vendors spread across caps (not only the first category). */
function buildCategoryAssignmentQueue(limits: TestSuiteCategoryLimit[]): string[] {
  const queue: string[] = []
  const remaining = new Map(
    limits.map((limit) => [limit.category_id, Math.max(0, limit.max_slots)])
  )

  let added = true
  while (added) {
    added = false
    for (const limit of limits) {
      const left = remaining.get(limit.category_id) ?? 0
      if (left <= 0) continue
      queue.push(limit.category_id)
      remaining.set(limit.category_id, left - 1)
      added = true
    }
  }

  return queue
}

function buildTestSuiteVendorGroups(
  targetVendorCount: number,
  limits: TestSuiteCategoryLimit[]
): { groups: VendorGroup[]; skipped: number } {
  const assignmentQueue = buildCategoryAssignmentQueue(limits)
  const effectiveTarget = Math.min(targetVendorCount, assignmentQueue.length)
  const limitById = new Map(limits.map((limit) => [limit.category_id, limit]))
  const groups: VendorGroup[] = []

  for (let i = 0; i < effectiveTarget; i++) {
    const template = DIVERSE_SEED_TEMPLATES[i % DIVERSE_SEED_TEMPLATES.length]!
    const categoryId = assignmentQueue[i]!
    const limit = limitById.get(categoryId)!
    const vendorName =
      effectiveTarget > DIVERSE_SEED_TEMPLATES.length
        ? `${template.businessName} (${i + 1})`
        : template.businessName

    groups.push({
      seedGroupId: `seed-group-${i + 1}`,
      vendorName,
      categoryName: limit.category_name,
      categoryId,
      tableCount: template.quantity,
      requestedBoothType: template.powerRequired ? 'power' : 'inside',
      serial: i + 1,
    })
  }

  return {
    groups,
    skipped: Math.max(0, targetVendorCount - effectiveTarget),
  }
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
    venuePresetId,
    roomName,
    categoryLimits,
  } = input

  if (categoryLimits.length === 0) {
    throw new Error('Add at least one category cap before populating the test suite.')
  }

  const limitsWithNames = categoryLimits.map((limit) => ({
    ...limit,
    category_name: limit.category_name || 'Uncategorized',
  }))

  const targetVendorCount = resolveTestSuiteTargetVendorCount({
    maxBoothCapacity,
    venuePresetId,
    roomName,
  })

  await clearTestSuiteApplications(supabase, eventId)

  const { groups, skipped } = buildTestSuiteVendorGroups(targetVendorCount, limitsWithNames)
  const now = new Date().toISOString()
  const applications: TestSuiteApplicationRecord[] = []

  for (const group of groups) {
    const categoryId = group.categoryId
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
