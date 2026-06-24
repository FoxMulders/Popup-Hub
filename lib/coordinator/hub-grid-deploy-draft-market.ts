import { checkCoordinatorPublishGate } from '@/lib/coordinator/publish-gate-client'

export type HubGridDeployDraftResult =
  | { ok: true }
  | { ok: false; error: string }

/** Publish a draft market from HubGrid after layout save — uses coordinator publish API. */
export async function deployDraftMarketFromHubGrid(
  eventId: string,
  fetchImpl: typeof fetch = fetch
): Promise<HubGridDeployDraftResult> {
  const publishBlock = await checkCoordinatorPublishGate()
  if (publishBlock) {
    return { ok: false, error: publishBlock }
  }

  const res = await fetchImpl(`/api/coordinator/events/${eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'published' }),
  })
  const data = (await res.json()) as { error?: string }
  if (!res.ok) {
    return { ok: false, error: data.error ?? 'Deploy failed — try again.' }
  }
  return { ok: true }
}
