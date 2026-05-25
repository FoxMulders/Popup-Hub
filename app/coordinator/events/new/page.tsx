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
    <div className="mx-auto max-w-[min(100%,1600px)] px-4 py-6 sm:py-8">
      <MarketSetupWizard
        categories={(categories as Category[]) ?? []}
        coordinatorId={user.id}
      />
    </div>
  )
}
