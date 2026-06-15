import { redirect } from 'next/navigation'

interface DashboardRedirectProps {
  searchParams: Promise<{ event?: string; view?: string; overview?: string }>
}

/** Legacy URL — canonical Blueprint Studio lives at `/coordinator/studio`. */
export default async function CoordinatorDashboardRedirect({ searchParams }: DashboardRedirectProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  if (params.event) qs.set('event', params.event)
  if (params.view) qs.set('view', params.view)
  if (params.overview) qs.set('overview', params.overview)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/coordinator/studio${suffix}`)
}
