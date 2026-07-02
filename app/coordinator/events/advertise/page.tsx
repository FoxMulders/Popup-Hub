import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { AdvertiseMarketForm } from '@/components/coordinator/conversion/advertise-market-form'
import { PageIntro } from '@/components/layout/page-intro'
import { buttonVariants } from '@/components/ui/button'
import { COORDINATOR_WELCOME_PATH } from '@/lib/coordinator/coordinator-routes'
import { cn } from '@/lib/utils'

export default async function AdvertiseMarketPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="coordinator-setup-page flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="setup-wizard-body flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain px-4 py-4 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] [-webkit-overflow-scrolling:touch] sm:px-6 sm:py-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <Link
            href={COORDINATOR_WELCOME_PATH}
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'w-fit gap-1.5 px-0')}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
          <PageIntro
            eyebrow="Ad listing"
            title="Advertise your market"
            description="List on PopupHub Discover without running booth ops here. Shoppers see your market and click through to your site."
          />
          <AdvertiseMarketForm />
        </div>
      </div>
    </div>
  )
}
