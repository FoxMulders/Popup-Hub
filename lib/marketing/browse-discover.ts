import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { requestUserLocation } from '@/lib/markets/user-location'

/**
 * Navigate to Discover without blocking on geolocation. Location is requested
 * in the background so patrons can browse immediately and refine area later.
 */
export function goToDiscover(router: AppRouterInstance): void {
  void requestUserLocation()
  router.push('/discover')
}
