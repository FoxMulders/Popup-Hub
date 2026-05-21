import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EventForm } from '@/components/coordinator/event-form'
import type { Category } from '@/types/database'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
        <p className="mt-1 text-gray-500">Drop a pin, set category slots, and deploy your market.</p>
      </div>
      <EventForm categories={(categories as Category[]) ?? []} coordinatorId={user.id} />
    </div>
  )
}
