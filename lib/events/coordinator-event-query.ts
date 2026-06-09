import type { SupabaseClient } from '@supabase/supabase-js'

export async function getCoordinatorScope(
  supabase: SupabaseClient,
  userId: string
): Promise<{ isAdmin: boolean; userId: string }> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  return { isAdmin: profile?.is_admin === true, userId }
}

/** Restrict event queries to owned markets unless the caller is a platform admin. */
export function applyCoordinatorEventScope<Q>(
  query: Q,
  coordinatorId: string,
  isAdmin: boolean
): Q {
  if (isAdmin) return query
  const chain = query as { eq: (column: string, value: string) => Q }
  return chain.eq('coordinator_id', coordinatorId)
}
