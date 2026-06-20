import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildDemoCategoryLimits,
  buildDemoLayoutPayload,
  buildDemoMarketDraft,
  buildDemoMarketSchedule,
} from '@/lib/coordinator/demo-market-template'
import { persistEventDraft, persistLayoutDraft } from '@/lib/wizard/wizard-autosave'

export async function createDemoMarketDraft(
  supabase: SupabaseClient,
  coordinatorId: string
): Promise<{ eventId: string } | { error: string }> {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('id, name')
    .order('name')
    .limit(3)

  if (catError) {
    return { error: catError.message }
  }

  const draft = buildDemoMarketDraft(coordinatorId)
  const categoryLimits = buildDemoCategoryLimits(categories ?? [])
  const { dayRows } = buildDemoMarketSchedule()

  const { eventId, error: draftError } = await persistEventDraft(
    supabase,
    null,
    { ...draft, coordinatorId },
    categoryLimits,
    dayRows,
    'single',
    { coordinatorId }
  )

  if (draftError || !eventId) {
    return { error: draftError?.message ?? 'Could not create demo market' }
  }

  const { payload } = buildDemoLayoutPayload(eventId)
  const { error: layoutError } = await persistLayoutDraft(supabase, eventId, payload)

  if (layoutError) {
    return { error: layoutError.message }
  }

  return { eventId }
}
