/** Fire-and-forget cache bust for public market listings after coordinator publish/status changes. */
export async function revalidateMarketsCacheClient(): Promise<void> {
  try {
    await fetch('/api/cache/revalidate-markets', { method: 'POST' })
  } catch {
    // Non-blocking — cached pages still expire within 60s.
  }
}
