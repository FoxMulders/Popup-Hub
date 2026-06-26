export async function resolveCoordinatorOpsSnapshotApplications<T>(options: {
  isOnline: boolean
  eventId: string
  serverApplications: T[]
  loadCachedApplications: (eventId: string) => Promise<T[] | null | undefined>
}): Promise<{ applications: T[]; hydratedFromCache: boolean }> {
  const { isOnline, eventId, serverApplications, loadCachedApplications } = options

  if (!isOnline) {
    const cached = await loadCachedApplications(eventId)
    if (cached?.length) {
      return { applications: cached, hydratedFromCache: true }
    }
  }

  return { applications: serverApplications, hydratedFromCache: false }
}
