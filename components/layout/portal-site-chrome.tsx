'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { SiteAppShell } from '@/components/layout/site-app-shell'
import {
  PortalWorkspaceLayout,
  routeUsesViewportFill,
  type WorkspacePortal,
} from '@/components/layout/portal-workspace-layout'
import { useCoordinatorRouteChromeCleanup } from '@/components/layout/use-coordinator-route-chrome-cleanup'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'

interface PortalSiteChromeProps {
  portal: WorkspacePortal
  profile: Profile
  availablePortals: ActivePortal[]
  portalCookie?: string
  vendorPortal?: boolean
  children: ReactNode
}

/** Client bridge: pathname-aware viewport fill + 3-column workspace grid. */
export function PortalSiteChrome({
  portal,
  profile,
  availablePortals,
  portalCookie,
  vendorPortal,
  children,
}: PortalSiteChromeProps) {
  const pathname = usePathname() ?? ''
  const viewportFill = routeUsesViewportFill(pathname)
  useCoordinatorRouteChromeCleanup()

  return (
    <SiteAppShell
      profile={profile}
      availablePortals={availablePortals}
      portalCookie={portalCookie}
      vendorPortal={vendorPortal}
      viewportFill={viewportFill}
    >
      <PortalWorkspaceLayout portal={portal}>{children}</PortalWorkspaceLayout>
    </SiteAppShell>
  )
}
