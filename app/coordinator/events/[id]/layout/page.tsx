import { notFound, redirect } from 'next/navigation'
import {
  SpatialLayoutEditor,
  type SpatialLayoutEditorProps,
} from '@/components/coordinator/spatial-layout/spatial-layout-editor'
import { createClient } from '@/lib/supabase/server'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import type { BoothLayout, Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EventLayoutPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const scope = await getCoordinatorScope(supabase, user.id)

  const [{ data: event }, { data: layoutData }] = await Promise.all([
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
    supabase.from('booth_layouts').select('*').eq('event_id', id).maybeSingle(),
  ])

  if (!event) notFound()

  if (event.status === 'cancelled' || event.status === 'completed') {
    redirect(`/coordinator/events/${id}`)
  }

  if (event.skip_venue_layout) {
    redirect(`/coordinator/events/${id}/setup?step=2`)
  }

  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      id,
      category_id,
      vendor_id,
      booth_number,
      status,
      table_length_ft,
      applied_at,
      neighbor_preference,
      vendor:profiles!booth_applications_vendor_id_fkey(
        full_name,
        passport:vendor_passports(business_name)
      ),
      category:categories(name)
    `)
    .eq('event_id', id)
    .order('applied_at', { ascending: true })

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <SpatialLayoutEditor
        eventId={id}
        event={event as Event}
        existingLayout={layoutData as BoothLayout | null}
        applications={
          (applications ?? []) as SpatialLayoutEditorProps['applications']
        }
      />
    </div>
  )
}
