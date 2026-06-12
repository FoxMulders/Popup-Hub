import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { CoordinatorHome } from '@/components/coordinator/coordinator-home'

export default async function CoordinatorHomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const [{ data: profile }, eventsQuery] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
    scope.isAdmin
      ? supabase.from('events').select('id', { count: 'exact', head: true })
      : supabase
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('coordinator_id', user.id),
  ])

  const marketCount = eventsQuery.count ?? 0

  return (
    <CoordinatorHome displayName={profile?.full_name ?? null} marketCount={marketCount} />
  )
}
