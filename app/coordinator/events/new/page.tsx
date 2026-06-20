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
    <div className="coordinator-setup-page flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="setup-wizard-body flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-6 lg:px-8">
        <MarketSetupWizard
          categories={(categories as Category[]) ?? []}
          coordinatorId={user.id}
        />
      </div>
    </div>
  )
}
