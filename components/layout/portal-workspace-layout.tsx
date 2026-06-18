'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { detectPortalFromPath } from '@/lib/portals/active-portal'
import { CommandCenterShell } from './command-center-shell'
import { CoordinatorWorkspaceRail } from './coordinator-workspace-rail'
import { CoordinatorContextPanel } from './coordinator-context-panel'
import { VendorWorkspaceRail } from './vendor-workspace-rail'
import { VendorContextPanel } from './vendor-context-panel'
import { isCoordinatorStudioPath } from '@/lib/coordinator/coordinator-routes'

export type WorkspacePortal = 'coordinator' | 'vendor'

interface PortalWorkspaceLayoutProps {
  portal: WorkspacePortal
  children: ReactNode
}

/** Routes that ship their own full 3-column command center (CAD + telemetry). */
function isFullCommandCenterRoute(pathname: string): boolean {
  return isCoordinatorStudioPath(pathname)
}

/** Event layout editor, setup wizard, and other full-viewport coordinator tools. */
function isCoordinatorImmersiveRoute(pathname: string): boolean {
  return (
    /\/coordinator\/events\/[^/]+\/layout\/?$/.test(pathname) ||
    /\/coordinator\/events\/[^/]+\/setup\/?$/.test(pathname) ||
    pathname === '/coordinator/events/new' ||
    pathname === '/coordinator/experience-designer' ||
    pathname.startsWith('/coordinator/experience-designer/')
  )
}

/** Routes that need full width (print, check-in scanners, etc.). */
function bypassWorkspace(pathname: string): boolean {
  return (
    /\/print(\/|$)/.test(pathname) ||
    /\/checkin(\/|$)/.test(pathname)
  )
}

function portalMatchesRoute(pathname: string, portal: WorkspacePortal): boolean {
  const routePortal = detectPortalFromPath(pathname)
  return routePortal !== 'patron' && routePortal === portal
}

function computeWorkspaceMode(
  pathname: string,
  portal: WorkspacePortal,
  vendorMobileSimple: boolean
): boolean {
  if (vendorMobileSimple) return false
  if (!portalMatchesRoute(pathname, portal)) return false
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
      pathname.startsWith('/vendor/applications/') ||
      pathname === '/vendor/supplies' ||
      pathname.startsWith('/vendor/supplies/') ||
      pathname === '/vendor/events' ||
      pathname.startsWith('/vendor/events/') ||
      pathname === '/vendor/passport' ||
      pathname.startsWith('/vendor/passport/')
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
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const update = () => setMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const vendorMobileSimple =
    mobile && portal === 'vendor' && pathname.startsWith('/vendor')
  const workspace = computeWorkspaceMode(pathname, portal, vendorMobileSimple)
  const viewportLocked = routeUsesViewportFill(pathname)

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
      documentScroll={!viewportLocked}
      left={left}
      center={
        viewportLocked ? (
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain site-surface p-4 [-webkit-overflow-scrolling:touch] lg:p-6">
            {children}
          </div>
        ) : (
          <div className="w-full site-surface p-4 lg:p-6">{children}</div>
        )
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

/** True when the route should fill the viewport below global nav (CAD, wizards, immersive tools). */
export function routeUsesViewportFill(pathname: string): boolean {
  if (bypassWorkspace(pathname)) return false

  return isFullCommandCenterRoute(pathname) || isCoordinatorImmersiveRoute(pathname)
}
