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

function parseInitialStep(step: string | undefined): 1 | 2 | 3 | 4 {
  const n = Number(step)
  if (n >= 1 && n <= 4) return n as 1 | 2 | 3 | 4
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
      vendor:profiles(full_name),
      passport:vendor_passports(business_name),
      category:categories(name)
    `)
    .eq('event_id', id)
    .order('applied_at', { ascending: true })

  return (
    <div className="mx-auto max-w-[min(100%,1600px)] px-4 py-8">
      <Link
        href={`/coordinator/events/${id}`}
        className={buttonVariants({ variant: 'ghost', size: 'sm' }) + ' gap-1.5 mb-6 -ml-2'}
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
        initialStep={parseInitialStep(step)}
      />
    </div>
  )
}
