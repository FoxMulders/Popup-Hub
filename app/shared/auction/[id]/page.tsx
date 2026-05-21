import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { AuctionRoom } from '@/components/auction/auction-room'
import type { Auction, Wallet } from '@/types/database'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin } from 'lucide-react'
import { format } from 'date-fns'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AuctionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: auction }, { data: wallet }, { data: profile }] = await Promise.all([
    supabase
      .from('auctions')
      .select('*, event:events(name, start_at, location_name)')
      .eq('id', id)
      .single(),
    supabase
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  if (!auction) notFound()

  const isCoordinator =
    profile?.role === 'coordinator' && auction.coordinator_id === user.id

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-10">
      <div className="mb-8">
        <Link href="/discover">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-gray-500 mb-3">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">{auction.title}</h1>
            <p className="text-xl text-gray-500 mt-1">{auction.item_name}</p>
            {auction.event && (
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm text-gray-500">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(auction.event.start_at), 'EEE, MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {auction.event.location_name}
                </div>
                <Badge variant="outline">{auction.event.name}</Badge>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuctionRoom
        auction={auction as Auction}
        wallet={wallet as Wallet | null}
        userId={user.id}
      />
    </div>
  )
}
