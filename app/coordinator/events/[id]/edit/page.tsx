import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditEventPage({ params }: Props) {
  const { id } = await params
  redirect(`/coordinator/events/${id}/setup`)
}
