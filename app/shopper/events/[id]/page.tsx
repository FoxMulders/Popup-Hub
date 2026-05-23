import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

/** Legacy shopper URL — public canonical path is /events/[id]. */
export default async function ShopperEventRedirect({ params }: Props) {
  const { id } = await params
  redirect(`/events/${id}`)
}
