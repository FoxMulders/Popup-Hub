import type { SupabaseClient } from '@supabase/supabase-js'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { BoothSlotAccessPhase } from '@/types/database'

const PRESERVED_PHASES = new Set<BoothSlotAccessPhase>([
  'priority_exclusive',
  'public_release',
])

export interface SyncBoothSlotsInput {
  eventId: string
  booths: BoothObject[]
  categoryNameToId: Record<string, string>
}

export function extractOpenVendorBooths(
  booths: BoothObject[]
): Array<{ layoutObjectId: string; categoryName: string }> {
  return booths
    .filter(
      (b) =>
        b.kind === 'booth' &&
        (b.tablePurpose ?? 'vendor') === 'vendor' &&
        !b.vendorId &&
        (b.categoryName?.trim() ?? '').length > 0
    )
    .map((b) => ({
      layoutObjectId: b.id,
      categoryName: b.categoryName!.trim(),
    }))
}

export function summarizeOpenBoothCategories(
  openBooths: Array<{ layoutObjectId: string; categoryName: string }>,
  categoryNameToId: Record<string, string>
): Array<{ categoryId: string; categoryName: string; openBoothCount: number }> {
  const counts = new Map<string, { categoryId: string; categoryName: string; count: number }>()

  for (const booth of openBooths) {
    const categoryId = categoryNameToId[booth.categoryName]
    if (!categoryId) continue
    const existing = counts.get(categoryId)
    if (existing) {
      existing.count += 1
    } else {
      counts.set(categoryId, {
        categoryId,
        categoryName: booth.categoryName,
        count: 1,
      })
    }
  }

  return [...counts.values()].map((row) => ({
    categoryId: row.categoryId,
    categoryName: row.categoryName,
    openBoothCount: row.count,
  }))
}

export async function syncEventBoothSlots(
  supabase: SupabaseClient,
  input: SyncBoothSlotsInput
): Promise<{ synced: number; removed: number }> {
  const openBooths = extractOpenVendorBooths(input.booths)
  const openIds = new Set(openBooths.map((b) => b.layoutObjectId))

  const { data: existing, error: loadError } = await supabase
    .from('event_booth_slots')
    .select('id, layout_object_id, access_phase, claimed_by_application_id')
    .eq('event_id', input.eventId)

  if (loadError) throw loadError

  const existingByLayoutId = new Map(
    (existing ?? []).map((row) => [row.layout_object_id as string, row])
  )

  let synced = 0
  for (const booth of openBooths) {
    const categoryId = input.categoryNameToId[booth.categoryName]
    if (!categoryId) continue

    const prior = existingByLayoutId.get(booth.layoutObjectId)
    if (prior) {
      if (prior.claimed_by_application_id) continue
      synced += 1
      continue
    }

    const { error } = await supabase.from('event_booth_slots').insert({
      event_id: input.eventId,
      layout_object_id: booth.layoutObjectId,
      category_id: categoryId,
      access_phase: 'coordinator_only',
    })
    if (error) throw error
    synced += 1
  }

  let removed = 0
  for (const row of existing ?? []) {
    const layoutId = row.layout_object_id as string
    const phase = row.access_phase as BoothSlotAccessPhase
    if (openIds.has(layoutId)) continue
    if (PRESERVED_PHASES.has(phase) || row.claimed_by_application_id) continue

    const { error } = await supabase.from('event_booth_slots').delete().eq('id', row.id)
    if (error) throw error
    removed += 1
  }

  return { synced, removed }
}
