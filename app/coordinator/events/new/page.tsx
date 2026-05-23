import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { MarketSetupWizard } from '@/components/coordinator/market-setup-wizard'
import type { Category } from '@/types/database'

export default async function NewEventPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-semibold text-foreground">Create New Event</h1>
        <p className="mt-1 text-muted-foreground">
          Four-step wizard — core details, venue, capacity, then floor plan canvas.
        </p>
      </div>
      <MarketSetupWizard
        categories={(categories as Category[]) ?? []}
        coordinatorId={user.id}
      />
    </div>
  )
}
