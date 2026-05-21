import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ApplicationBoard } from '@/components/coordinator/application-board'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'
import type { BoothApplication, Event } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ApplicationsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: event }, { data: applications }] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('coordinator_id', user.id)
      .single(),
    supabase
      .from('booth_applications')
      .select(`
        *,
        vendor:profiles(id, full_name, avatar_url),
        passport:vendor_passports(business_name, bio, logo_url, item_image_urls, is_verified),
        category:categories(name)
      `)
      .eq('event_id', id)
      .order('applied_at', { ascending: true }),
  ])

  if (!event) notFound()

  return (
    <div className="mx-auto max-w-[1500px] px-6 py-10 xl:px-10">
      <div className="mb-8 space-y-2">
        <Link href={`/coordinator/events/${id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-gray-500 mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Event
          </Button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{event.name}</h1>
            <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {format(new Date(event.start_at), 'EEE, MMM d, yyyy')}
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {event.location_name}
              </div>
              <Badge variant="outline" className="capitalize">
                {event.booking_mode === 'instant' ? '⚡ Instant Book' : '🔍 Juried'}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <ApplicationBoard
        applications={(applications ?? []) as BoothApplication[]}
        bookingMode={(event as Event).booking_mode}
      />
    </div>
  )
}
