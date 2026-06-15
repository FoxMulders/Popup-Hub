/** Routes where coordinators edit floor plans and need the layout help entry in site chrome. */
import { isCoordinatorStudioOrLegacyDashboardPath } from '@/lib/coordinator/coordinator-routes'

export function isCoordinatorLayoutHelpNavRoute(pathname: string): boolean {
  return isCoordinatorStudioOrLegacyDashboardPath(pathname)
}
