'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  Calendar,
  CreditCard,
  LayoutDashboard,
  Plus,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  CommandCenterExitButton,
  CommandCenterExitLink,
} from '@/components/coordinator/command-center-exit-link'
import {
  coordinatorEventIdFromPath,
  isCoordinatorEventHubPath,
} from '@/lib/coordinator/coordinator-event-route'
import {
  COORDINATOR_HOME_PATH,
  COORDINATOR_STUDIO_PATH,
  coordinatorHubGridNavHref,
  coordinatorStudioHref,
  isCoordinatorStudioPath,
} from '@/lib/coordinator/coordinator-routes'
import { useIsMobileNav } from '@/hooks/use-is-mobile-nav'

const RAIL_LINKS_BASE = [
  { href: COORDINATOR_HOME_PATH, label: 'Home', icon: Calendar },
  { href: '_hubgrid', label: 'HubGrid', icon: LayoutDashboard },
  { href: '/coordinator/events/new', label: 'New market', icon: Plus },
  { href: '/coordinator/payment-methods', label: 'Payments', icon: CreditCard },
  { href: '/wallet', label: 'PopupFunds', icon: Settings },
] as const

export function CoordinatorWorkspaceRail() {
  const pathname = usePathname() ?? ''
  const mobile = useIsMobileNav()
  const hubGridHref = coordinatorHubGridNavHref({ mobile })
  const railLinks = RAIL_LINKS_BASE.map((link) =>
    link.href === '_hubgrid' ? { ...link, href: hubGridHref } : link
  )
  const eventIdFromRoute = coordinatorEventIdFromPath(pathname)
  const onStudio = isCoordinatorStudioPath(pathname)
  const onEventHub = isCoordinatorEventHubPath(pathname)

  return (
    <nav
      className="flex h-full min-h-0 flex-col gap-3 p-3"
      aria-label="Coordinator workspace"
    >
      {eventIdFromRoute && !onStudio ? (
        onEventHub ? (
          <CommandCenterExitLink
            eventId={eventIdFromRoute}
            target="studio"
            compact
            className="w-full"
          />
        ) : (
          <CommandCenterExitButton
            eventId={eventIdFromRoute}
            target="event-overview"
            compact
            className="w-full"
          />
        )
      ) : null}

      <div className="marketing-glass-card rounded-xl p-3">
        <p className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
          Market ops
        </p>
        <p className="mt-0.5 text-sm font-bold text-foreground">
          Popup Hub
        </p>
        <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
          3-column ecosystem · CAD · Square telemetry
        </p>
      </div>

      <ul className="flex flex-col gap-1" role="list">
        {railLinks.map(({ href, label, icon: Icon }) => {
          const active =
            href === COORDINATOR_HOME_PATH
              ? pathname === COORDINATOR_HOME_PATH
              : href === hubGridHref || href === COORDINATOR_STUDIO_PATH
                ? isCoordinatorStudioPath(pathname)
                : pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[0.8125rem] font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2',
                  active
                    ? 'border-sky-300/80 bg-sky-50 text-sky-950 shadow-[0_0_12px_rgb(56_189_248/0.12)]'
                    : 'border-transparent text-stone-700 hover:border-stone-200/80 hover:bg-card/90'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <motion.div
        layout
        className="mt-auto ecosystem-panel-inner rounded-xl border border-dashed border-sky-300/50 bg-sky-50/40 p-3"
      >
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-sky-900">
          <Calendar className="h-3.5 w-3.5" aria-hidden />
          Floor plan & assignments
        </p>
        <p className="mt-1 text-[0.6875rem] leading-snug text-sky-800/90">
          {eventIdFromRoute
            ? onEventHub
              ? 'Open HubGrid for CAD booth design and live payment telemetry.'
              : 'Return to this market’s overview, or open HubGrid for CAD and payments.'
            : 'Open HubGrid for the booth designer and live financial desk.'}
        </p>
        {eventIdFromRoute && !onEventHub ? (
          <CommandCenterExitButton
            eventId={eventIdFromRoute}
            target="event-overview"
            compact
            className={cn(
              buttonVariants({ size: 'sm', variant: 'outline' }),
              'mt-2 w-full text-xs'
            )}
          />
        ) : null}
        <Link
          href={
            eventIdFromRoute
              ? coordinatorStudioHref(eventIdFromRoute)
              : coordinatorHubGridNavHref({ mobile })
          }
          className={cn(
            buttonVariants({ size: 'sm' }),
            'w-full text-xs',
            eventIdFromRoute ? 'mt-1.5' : 'mt-2'
          )}
        >
          Open HubGrid
        </Link>
      </motion.div>
    </nav>
  )
}
