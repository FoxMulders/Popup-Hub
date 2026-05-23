/** FCFS ordering: earliest applied_at first; tie-break on application id (sequential UUID). */
export function compareFcfsApplicationOrder(
  a: { id: string; appliedAt: string | null | undefined },
  b: { id: string; appliedAt: string | null | undefined }
): number {
  const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : Number.MAX_SAFE_INTEGER
  const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : Number.MAX_SAFE_INTEGER
  if (ta !== tb) return ta - tb
  return a.id.localeCompare(b.id)
}

export function sortVendorsFcfs<T extends { id: string }>(
  vendors: T[],
  appliedAtById: Record<string, string | undefined>
): T[] {
  return [...vendors].sort((a, b) =>
    compareFcfsApplicationOrder(
      { id: a.id, appliedAt: appliedAtById[a.id] },
      { id: b.id, appliedAt: appliedAtById[b.id] }
    )
  )
}
