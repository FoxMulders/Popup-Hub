import { redirect } from 'next/navigation'

interface LedgerRedirectProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** Legacy dual-screen ledger URL. */
export default async function CoordinatorDashboardLedgerRedirect({ searchParams }: LedgerRedirectProps) {
  const params = await searchParams
  const qs = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value)
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0])
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  redirect(`/coordinator/studio/ledger${suffix}`)
}
