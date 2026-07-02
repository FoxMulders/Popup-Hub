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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-10">
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
  )
}
