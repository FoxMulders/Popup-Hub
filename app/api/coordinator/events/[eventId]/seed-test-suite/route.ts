import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { canActAsCoordinator } from '@/lib/auth/rbac'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { persistTestSuiteApplications, resolveTestSuiteTargetVendorCount } from '@/lib/booth-planner/persist-test-suite-applications'

/** Kill switch only — coordinator auth + event scope are enforced below. */
function testSuiteSeedAllowed(): boolean {
  if (process.env.DISABLE_COORDINATOR_TEST_SUITE === 'true') return false
  return true
}
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ eventId: string }> }
) {
  if (!testSuiteSeedAllowed()) {
    return NextResponse.json({ error: 'Test suite seeding is disabled in this environment' }, { status: 404 })
  }

  const { eventId } = await params
  const supabase = await createClient()
  const adminSupabase = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_admin')
    .eq('id', user.id)
    .single()

  if (!canActAsCoordinator(profile)) {
    return NextResponse.json({ error: 'Coordinator account required' }, { status: 403 })
  }

  const scope = await getCoordinatorScope(supabase, user.id)

  const { data: event, error: eventError } = await applyCoordinatorEventScope(
    adminSupabase
      .from('events')
      .select(
        `
        id,
        coordinator_id,
        category_limits:event_category_limits(
          category_id,
          max_slots,
          category:categories(name)
        )
      `
      )
      .eq('id', eventId),
    user.id,
    scope.isAdmin
  ).single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  const { data: layout } = await adminSupabase
    .from('booth_layouts')
    .select('layout_rooms, venue_preset_id')
    .eq('event_id', eventId)
    .maybeSingle()

  const rooms =
    (layout?.layout_rooms as Array<{
      name?: string
      venue_preset_id?: string | null
    }> | null) ?? []

  const activeRoom = rooms[0]

  const categoryLimits =
    (
      event.category_limits as Array<{
        category_id: string
        max_slots: number
        category?: { name?: string | null } | { name?: string | null }[] | null
      }> | null
    )?.map((row) => {
      const category = Array.isArray(row.category) ? row.category[0] : row.category
      return {
        category_id: row.category_id,
        category_name: category?.name?.trim() ?? 'Uncategorized',
        max_slots: row.max_slots,
      }
    }) ?? []

  const maxBoothCapacity = categoryLimits.reduce((sum, row) => sum + Math.max(0, row.max_slots), 0)
  const targetVendorCount = resolveTestSuiteTargetVendorCount({
    maxBoothCapacity,
    venuePresetId: activeRoom?.venue_preset_id ?? layout?.venue_preset_id ?? null,
    roomName: activeRoom?.name ?? null,
  })

  try {
    const result = await persistTestSuiteApplications({
      supabase: adminSupabase,
      authAdmin: adminSupabase.auth.admin,
      eventId,
      coordinatorId: event.coordinator_id,
      maxBoothCapacity,
      venuePresetId: activeRoom?.venue_preset_id ?? layout?.venue_preset_id ?? null,
      roomName: activeRoom?.name ?? null,
      categoryLimits,
    })

    return NextResponse.json({
      ok: true,
      targetVendorCount,
      vendorCount: result.vendorCount,
      applicationCount: result.applicationCount,
      tableSlots: result.tableSlots,
      skippedForCapacity: result.skippedForCapacity,
      applications: result.applications,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test suite seed failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
