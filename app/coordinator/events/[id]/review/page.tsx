import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { computeLayoutTelemetrySummary } from '@/lib/coordinator/layout-telemetry-summary'
import { PreFlightReviewClient } from '@/components/coordinator/pre-flight-review/pre-flight-review-client'
import type { BoothLayout, Category, Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PreFlightReviewPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const [{ data: event }, { data: categories }, { data: layoutData }] = await Promise.all([
    applyCoordinatorEventScope(
      supabase
        .from('events')
        .select(
          `
        *,
        category_limits:event_category_limits(*, category:categories(name))
      `
        )
        .eq('id', id),
      user.id,
      scope.isAdmin
    ).single(),
    supabase.from('categories').select('*').order('name'),
    supabase.from('booth_layouts').select('*').eq('event_id', id).maybeSingle(),
  ])

  if (!event) notFound()

  if (event.status === 'cancelled' || event.status === 'completed') {
    redirect(`/coordinator/events/${id}`)
  }

  const layoutTelemetry = computeLayoutTelemetrySummary(id, layoutData as BoothLayout | null)

  return (
    <PreFlightReviewClient
      event={event as Event}
      categories={(categories as Category[]) ?? []}
      layoutTelemetry={layoutTelemetry}
    />
  )
}
