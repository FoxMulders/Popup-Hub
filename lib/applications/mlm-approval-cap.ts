import type { Category } from '@/types/database'
import { isMlmCategory, isSingleSlotMlmBrand } from '@/lib/categories/mlm-constraints'

interface ApplicationLite {
  category_id: string | null
  status: string | null
}

/**
 * Count current approved/reserved MLM applications. Used to gate approvals so
 * coordinators cannot accept more MLM vendors than the configured `globalMlmCap`.
 */
export function countApprovedMlmApplications(
  applications: ApplicationLite[],
  categories: Pick<Category, 'id' | 'name' | 'is_mlm'>[]
): number {
  const byId = new Map(categories.map((c) => [c.id, c]))
  return applications.filter((app) => {
    if (!app.category_id) return false
    const cat = byId.get(app.category_id)
    const isMlm = cat ? isMlmCategory(cat) : false
    if (!isMlm) return false
    return app.status === 'approved' || app.status === 'pending_insurance'
  }).length
}

export function exceedsMlmApprovalCap(
  applications: ApplicationLite[],
  categories: Pick<Category, 'id' | 'name' | 'is_mlm'>[],
  globalMlmCap: number,
  candidateCategoryId: string | null
): boolean {
  if (!candidateCategoryId) return false
  const cat = categories.find((c) => c.id === candidateCategoryId)
  const isMlm = cat ? isMlmCategory(cat) : false
  if (!isMlm) return false
  return countApprovedMlmApplications(applications, categories) >= Math.max(0, globalMlmCap)
}

export { isMlmCategory, isSingleSlotMlmBrand }
