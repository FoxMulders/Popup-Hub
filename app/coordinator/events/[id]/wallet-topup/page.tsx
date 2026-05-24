import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketDayShell } from '@/components/coordinator/market-day-shell'
import { DoorWalletTopUp } from '@/components/coordinator/door-wallet-topup'
import { parseWalletTopUpQrPayload } from '@/lib/wallet/wallet-qr'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ u?: string; user?: string }>
}

export default async function EventWalletTopUpPage({ params, searchParams }: Props) {
  const { id } = await params
  const query = await searchParams
  const initialUserId = parseWalletTopUpQrPayload(query.u ?? query.user ?? '')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, coordinator_id, status')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()

  return (
    <MarketDayShell eventId={id} eventName={event.name} activeSection="wallet">
      <DoorWalletTopUp eventId={id} initialUserId={initialUserId} />
    </MarketDayShell>
  )
}
