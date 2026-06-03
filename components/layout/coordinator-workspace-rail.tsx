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
import { Button } from '@/components/ui/button'
import { CommandCenterExitLink } from '@/components/coordinator/command-center-exit-link'
import {
  coordinatorEventIdFromPath,
  coordinatorNavBackHref,
} from '@/lib/coordinator/coordinator-event-route'

const RAIL_LINKS = [
  { href: '/coordinator/dashboard', label: 'Command center', icon: LayoutDashboard },
  { href: '/coordinator/events/new', label: 'New market', icon: Plus },
  { href: '/coordinator/payment-methods', label: 'Payments', icon: CreditCard },
  { href: '/wallet', label: 'Wallet', icon: Settings },
] as const

export function CoordinatorWorkspaceRail() {
  const pathname = usePathname() ?? ''
  const eventIdFromRoute = coordinatorEventIdFromPath(pathname)
  const onCommandCenter = pathname === '/coordinator/dashboard'

  return (
    <nav
      className="flex h-full min-h-0 flex-col gap-3 p-3"
      aria-label="Coordinator workspace"
    >
      {eventIdFromRoute && !onCommandCenter ? (
        <CommandCenterExitLink eventId={eventIdFromRoute} compact className="w-full" />
      ) : null}

      <div className="ecosystem-panel-inner rounded-xl border border-stone-200/80 bg-card/80 p-3">
        <p className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
          Market ops
        </p>
        <p className="mt-0.5 font-heading text-sm font-semibold text-foreground">
          Popup Hub
        </p>
        <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
          3-column ecosystem · CAD · Square telemetry
        </p>
      </div>

      <ul className="flex flex-col gap-1" role="list">
        {RAIL_LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/coordinator/dashboard'
              ? pathname === '/coordinator/dashboard'
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
            ? 'Return to this market’s overview, or open the command center for CAD and payments.'
            : 'Open the command center for the CAD booth designer and live financial desk.'}
        </p>
        {eventIdFromRoute ? (
          <Link
            href={coordinatorNavBackHref(pathname)}
            className="mt-2 block"
          >
            <Button size="sm" variant="outline" className="w-full text-xs">
              Event overview
            </Button>
          </Link>
        ) : null}
        <Link
          href={
            eventIdFromRoute
              ? `/coordinator/dashboard?event=${eventIdFromRoute}`
              : '/coordinator/dashboard'
          }
          className={cn('block', eventIdFromRoute ? 'mt-1.5' : 'mt-2')}
        >
          <Button size="sm" className="w-full text-xs">
            Open command center
          </Button>
        </Link>
      </motion.div>
    </nav>
  )
}
