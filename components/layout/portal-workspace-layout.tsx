'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { CommandCenterShell } from './command-center-shell'
import { CoordinatorWorkspaceRail } from './coordinator-workspace-rail'
import { CoordinatorContextPanel } from './coordinator-context-panel'
import { VendorWorkspaceRail } from './vendor-workspace-rail'
import { VendorContextPanel } from './vendor-context-panel'

export type WorkspacePortal = 'coordinator' | 'vendor'

interface PortalWorkspaceLayoutProps {
  portal: WorkspacePortal
  children: ReactNode
}

/** Routes that ship their own full 3-column command center (CAD + telemetry). */
function isFullCommandCenterRoute(pathname: string): boolean {
  return pathname === '/coordinator/dashboard'
}

/** Event layout editor and setup wizard — own the full viewport below nav. */
function isCoordinatorImmersiveRoute(pathname: string): boolean {
  return (
    /\/coordinator\/events\/[^/]+\/layout\/?$/.test(pathname) ||
    /\/coordinator\/events\/[^/]+\/setup\/?$/.test(pathname) ||
    pathname === '/coordinator/events/new'
  )
}

/** Routes that need full width (print, check-in scanners, etc.). */
function bypassWorkspace(pathname: string): boolean {
  return (
    /\/print(\/|$)/.test(pathname) ||
    /\/checkin(\/|$)/.test(pathname)
  )
}

function useWorkspaceMode(pathname: string, portal: WorkspacePortal): boolean {
  if (bypassWorkspace(pathname)) return false
  if (isFullCommandCenterRoute(pathname)) return false
  if (isCoordinatorImmersiveRoute(pathname)) return false

  if (portal === 'coordinator') {
    return pathname.startsWith('/coordinator')
  }

  if (portal === 'vendor') {
    return (
      pathname === '/vendor/dashboard' ||
      pathname.startsWith('/vendor/dashboard/') ||
      pathname === '/vendor/applications' ||
      pathname.startsWith('/vendor/applications/')
    )
  }

  return false
}

/**
 * Wraps portal pages in the site-wide 320 | 1fr | 360 workspace grid when appropriate.
 * The coordinator command center page manages its own shell + market context.
 */
export function PortalWorkspaceLayout({
  portal,
  children,
}: PortalWorkspaceLayoutProps) {
  const pathname = usePathname() ?? ''
  const workspace = useWorkspaceMode(pathname, portal)

  if (!workspace) {
    return <>{children}</>
  }

  const left =
    portal === 'coordinator' ? (
      <CoordinatorWorkspaceRail />
    ) : (
      <VendorWorkspaceRail />
    )
  const right =
    portal === 'coordinator' ? (
      <CoordinatorContextPanel />
    ) : (
      <VendorContextPanel />
    )

  return (
    <CommandCenterShell
      left={left}
      center={
        <div className="h-full min-h-0 overflow-y-auto overflow-x-hidden bg-canvas p-4 lg:p-6">
          {children}
        </div>
      }
      right={right}
      leftLabel={portal === 'coordinator' ? 'Coordinator curation queue' : 'Vendor navigation'}
      centerLabel="Page workspace"
      rightLabel={
        portal === 'coordinator'
          ? 'Telemetry and Square sync desk'
          : 'Vendor payments desk'
      }
    />
  )
}

/** True when the route should fill the viewport below global nav. */
export function routeUsesViewportFill(pathname: string): boolean {
  if (bypassWorkspace(pathname)) return false
  return (
    isFullCommandCenterRoute(pathname) ||
    pathname.startsWith('/coordinator') ||
    pathname === '/vendor/dashboard' ||
    pathname.startsWith('/vendor/dashboard/') ||
    pathname === '/vendor/applications' ||
    pathname.startsWith('/vendor/applications/')
  )
}
