import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { applyCoordinatorEventScope, getCoordinatorScope } from '@/lib/events/coordinator-event-query'
import { MarketSetupWizard } from '@/components/coordinator/market-setup-wizard'
import { buttonVariants } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import type { BoothLayout, Category, Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ step?: string }>
}

/**
 * Resolves the initial wizard step from a URL `?step=` query param.
 * The wizard is now a 3-step flow (Event & Venue → Capacity → Floor Plan),
 * but legacy URLs may still pass the old 1–4 numbering. Map them onto the
 * new range and clamp to 2 when the coordinator opted out of the layout
 * canvas.
 */
function parseInitialStep(step: string | undefined, skipVenueLayout: boolean): 1 | 2 | 3 {
  const n = Number(step)
  if (Number.isFinite(n) && n >= 1) {
    // Legacy URL mapping: old 1+2 collapsed to 1, old 3 → 2, old 4 → 3.
    let mapped: 1 | 2 | 3
    if (n <= 2) mapped = 1
    else if (n === 3) mapped = 2
    else mapped = 3
    if (skipVenueLayout && mapped === 3) return 2
    return mapped
  }
  return 1
}

export default async function EventSetupPage({ params, searchParams }: Props) {
  const { id } = await params
  const { step } = await searchParams
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
        category_limits:event_category_limits(*, category:categories(name)),
        event_days(*)
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
    <div className="coordinator-setup-page flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="setup-page-chrome shrink-0 px-4 pt-4 sm:px-6 lg:px-8">
        <Link
          href={`/coordinator/events/${id}`}
          className={
            buttonVariants({ variant: 'ghost', size: 'sm' }) + ' setup-page-back-link gap-1.5 -ml-2'
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Back to event
        </Link>
      </div>
      <div className="setup-wizard-body flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 pb-4 [-webkit-overflow-scrolling:touch] sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
      <MarketSetupWizard
        coordinatorId={user.id}
        categories={(categories as Category[]) ?? []}
        existing={event as Event}
        existingLayout={layoutData as BoothLayout | null}
        applications={(applications ?? []) as unknown as Parameters<typeof MarketSetupWizard>[0]['applications']}
        initialStep={parseInitialStep(step, Boolean((event as Event).skip_venue_layout))}
      />
      </div>
    </div>
  )
}
