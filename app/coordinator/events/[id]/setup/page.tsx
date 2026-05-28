import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
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

  const [{ data: event }, { data: categories }, { data: layoutData }] = await Promise.all([
    supabase
      .from('events')
      .select(
        `
        *,
        category_limits:event_category_limits(*, category:categories(name)),
        event_days(*)
      `
      )
      .eq('id', id)
      .eq('coordinator_id', user.id)
      .single(),
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
    <div className="w-full px-4 py-8 sm:px-6 lg:px-8 workspace-fullscreen-tight-pad">
      <Link
        href={`/coordinator/events/${id}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' gap-1.5 mb-6 -ml-2 workspace-fullscreen-hide'}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to event
      </Link>
      <MarketSetupWizard
        coordinatorId={user.id}
        categories={(categories as Category[]) ?? []}
        existing={event as Event}
        existingLayout={layoutData as BoothLayout | null}
        applications={(applications ?? []) as unknown as Parameters<typeof MarketSetupWizard>[0]['applications']}
        initialStep={parseInitialStep(step, Boolean((event as Event).skip_venue_layout))}
      />
    </div>
  )
}
