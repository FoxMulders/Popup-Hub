/** FCFS ordering: premium priority boost, then earliest applied_at; tie-break on id. */
export function compareFcfsApplicationOrder(
  a: {
    id: string
    appliedAt: string | null | undefined
    priorityBoost?: boolean
  },
  b: {
    id: string
    appliedAt: string | null | undefined
    priorityBoost?: boolean
  }
): number {
  if (a.priorityBoost && !b.priorityBoost) return -1
  if (!a.priorityBoost && b.priorityBoost) return 1

  const ta = a.appliedAt ? new Date(a.appliedAt).getTime() : Number.MAX_SAFE_INTEGER
  const tb = b.appliedAt ? new Date(b.appliedAt).getTime() : Number.MAX_SAFE_INTEGER
  if (ta !== tb) return ta - tb
  return a.id.localeCompare(b.id)
}

export function sortVendorsFcfs<T extends { id: string }>(
  vendors: T[],
  appliedAtById: Record<string, string | undefined>,
  priorityBoostById: Record<string, boolean | undefined> = {}
): T[] {
  return [...vendors].sort((a, b) =>
    compareFcfsApplicationOrder(
      {
        id: a.id,
        appliedAt: appliedAtById[a.id],
        priorityBoost: priorityBoostById[a.id],
      },
      {
        id: b.id,
        appliedAt: appliedAtById[b.id],
        priorityBoost: priorityBoostById[b.id],
      }
    )
  )
}
