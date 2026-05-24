export type CategoryCapacityRow = {
  id: string
  categoryId: string
  categoryName: string
  maxSlots: number
  approvedCount: number
  pricePerBooth: number
}

type CategoryLimitInput = {
  id: string
  category_id: string
  max_slots: number
  price_per_booth: number
  category?: { name?: string | null } | null
}

type ApplicationInput = {
  category_id: string
  status: string
}

export function buildCategoryCapacityRows(
  limits: CategoryLimitInput[],
  applications: ApplicationInput[]
): CategoryCapacityRow[] {
  const approvedByCategory = new Map<string, number>()

  for (const application of applications) {
    if (application.status !== 'approved' && application.status !== 'pending_insurance') continue
    approvedByCategory.set(
      application.category_id,
      (approvedByCategory.get(application.category_id) ?? 0) + 1
    )
  }

  return limits.map((limit) => ({
    id: limit.id,
    categoryId: limit.category_id,
    categoryName: limit.category?.name ?? 'Unnamed category',
    maxSlots: limit.max_slots,
    approvedCount: approvedByCategory.get(limit.category_id) ?? 0,
    pricePerBooth: limit.price_per_booth,
  }))
}

export function getCategoryAvailability(approvedCount: number, maxSlots: number) {
  const available = Math.max(0, maxSlots - approvedCount)
  const fillPercent =
    maxSlots > 0 ? Math.min(100, Math.round((approvedCount / maxSlots) * 100)) : 0

  if (available <= 0) {
    return {
      available,
      fillPercent,
      tone: 'full' as const,
      label: 'Full',
    }
  }

  if (available === 1) {
    return {
      available,
      fillPercent,
      tone: 'low' as const,
      label: '1 spot left',
    }
  }

  return {
    available,
    fillPercent,
    tone: 'open' as const,
    label: `${available} spots left`,
  }
}
