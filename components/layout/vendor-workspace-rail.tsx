'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Store,
  Ticket,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const RAIL_LINKS = [
  { href: '/vendor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/vendor/applications', label: 'Applications', icon: ClipboardList },
  { href: '/vendor/supplies', label: 'Supplies', icon: Package },
  { href: '/vendor/events', label: 'Open markets', icon: Store },
  { href: '/vendor/passport', label: 'Passport', icon: Ticket },
] as const

export function VendorWorkspaceRail() {
  const pathname = usePathname()

  return (
    <nav
      className="flex h-full min-h-0 flex-col gap-3 p-3"
      aria-label="Vendor workspace"
    >
      <div className="ecosystem-panel-inner rounded-xl border border-stone-200/80 bg-card/80 p-3">
        <p className="text-[0.625rem] font-bold uppercase tracking-wider text-muted-foreground">
          Vendor desk
        </p>
        <p className="mt-0.5 font-heading text-sm font-semibold">Your markets</p>
        <p className="mt-1 text-[0.6875rem] leading-snug text-muted-foreground">
          Bookings, payments, and passport — synced across Popup Hub.
        </p>
      </div>

      <ul className="flex flex-col gap-1" role="list">
        {RAIL_LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`)
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[0.8125rem] font-medium transition-colors duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2',
                  active
                    ? 'border-violet-300/70 bg-violet-50 text-violet-950 shadow-[0_0_12px_rgb(139_92_246/0.1)]'
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
    </nav>
  )
}
