import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BoothLayoutPage({ params }: Props) {
  const { id } = await params
  redirect(`/coordinator/events/${id}/setup?step=4`)
}
