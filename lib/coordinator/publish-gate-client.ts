/** Client-side publish gate — mirrors server checks for UX before Supabase status update. */
export async function checkCoordinatorPublishGate(): Promise<string | null> {
  const res = await fetch('/api/coordinator/verification')
  if (!res.ok) {
    return 'Could not verify organizer status before publishing.'
  }
  const data = (await res.json()) as { publishBlockReason?: string | null }
  return data.publishBlockReason ?? null
}
