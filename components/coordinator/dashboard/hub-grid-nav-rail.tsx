'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Calendar,
  CreditCard,
  LayoutDashboard,
  Plus,
  Settings,
  Store,
} from 'lucide-react'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { BrandLogoMark } from '@/components/brand/popup-hub-logo'
import {
  COORDINATOR_HOME_PATH,
  COORDINATOR_MARKETS_PATH,
  COORDINATOR_STUDIO_PATH,
  isCoordinatorStudioPath,
} from '@/lib/coordinator/coordinator-routes'
import { cn } from '@/lib/utils'
import { useDashboardWorkspaceView } from './dashboard-workspace-view-context'

const RAIL_LINKS = [
  { href: COORDINATOR_HOME_PATH, label: 'Home', icon: Calendar },
  { href: COORDINATOR_MARKETS_PATH, label: 'Markets', icon: Store },
  { href: COORDINATOR_STUDIO_PATH, label: 'HubGrid', icon: LayoutDashboard },
  { href: '/coordinator/events/new', label: 'New Event', icon: Plus },
  { href: '/coordinator/payment-methods', label: 'Payments', icon: CreditCard },
  { href: '/wallet', label: 'Wallet', icon: Settings },
] as const

function isActivePath(pathname: string, href: string): boolean {
  if (href === COORDINATOR_HOME_PATH) return pathname === COORDINATOR_HOME_PATH
  if (href === COORDINATOR_STUDIO_PATH) return isCoordinatorStudioPath(pathname)
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Slim icon rail — replaces global AppNav on HubGrid blueprint. */
export function HubGridNavRail({ className }: { className?: string }) {
  const pathname = usePathname() ?? ''
  const { isBlueprint } = useDashboardWorkspaceView()

  if (!isBlueprint) return null

  return (
    <nav
      className={cn(
        'hub-grid-nav-rail flex h-full w-[var(--hub-grid-nav-rail-width,3rem)] shrink-0 flex-col items-center border-r border-stone-200/80 bg-cream/95 py-2 backdrop-blur-sm',
        className
      )}
      aria-label="Coordinator navigation"
    >
      <Link
        href={COORDINATOR_HOME_PATH}
        className="mb-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-stone-100"
        aria-label="Popup Hub home"
      >
        <BrandLogoMark size="nav" className="h-7 w-7" />
      </Link>

      <ul className="flex flex-1 flex-col items-center gap-1" role="list">
        {RAIL_LINKS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href)
          return (
            <li key={href}>
              <TooltipWrapper text={label}>
                <Link
                  href={href}
                  className={cn(
                    'inline-flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-1',
                    active
                      ? 'bg-forest text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  )}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </Link>
              </TooltipWrapper>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
