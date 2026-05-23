import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AuctionRoom } from '@/components/auction/auction-room'
import type { Auction, Wallet } from '@/types/database'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuctionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=${encodeURIComponent(`/auctions/${id}`)}`)

  const [{ data: auction }, { data: wallet }] = await Promise.all([
    supabase
      .from('auctions')
      .select('*, event:events(name, start_at, location_name)')
      .eq('id', id)
      .single(),
    supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  if (!auction) notFound()

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 pb-8">
      <Link href="/discover">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </Link>
      <AuctionRoom
        auction={auction as Auction}
        wallet={wallet as Wallet | null}
        userId={user.id}
      />
    </div>
  )
}
