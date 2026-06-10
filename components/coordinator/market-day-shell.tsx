'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowLeft, ClipboardList, LayoutDashboard, ListOrdered, CheckSquare, QrCode, Gavel, Wallet } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MarketDayShellProps {
  eventId: string
  eventName: string
  children: React.ReactNode
  /** Active section for sub-nav highlighting */
  activeSection?: 'operations' | 'layout' | 'checkin' | 'auctions' | 'wallet'
}

const SECTIONS = [
  { id: 'operations' as const, label: 'Operations', href: (id: string) => `/coordinator/events/${id}/operations`, icon: ClipboardList },
  { id: 'wallet' as const, label: 'Wallet top-up', href: (id: string) => `/coordinator/events/${id}/wallet-topup`, icon: Wallet },
  { id: 'auctions' as const, label: 'Auctions', href: (id: string) => `/coordinator/events/${id}/auctions`, icon: Gavel },
  { id: 'layout' as const, label: 'Spatial Planner', href: (id: string) => `/coordinator/events/${id}/layout`, icon: LayoutDashboard },
  { id: 'checkin' as const, label: 'Check-In QR', href: (id: string) => `/coordinator/events/${id}/checkin`, icon: QrCode },
]

export function MarketDayShell({
  eventId,
  eventName,
  children,
  activeSection = 'operations',
}: MarketDayShellProps) {
  const pathname = usePathname()

  return (
    <div className="market-day-page flex min-h-screen flex-col">
      <header className="safe-top border-b border-sage-200/80 bg-gradient-to-b from-sage-50 to-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Link
                href={`/coordinator/events/${eventId}`}
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'gap-1.5 text-sage-700 hover:text-sage-900 -ml-2')}
              >
                <ArrowLeft className="h-4 w-4" />
                Event overview
              </Link>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-sage-600">
                  Market Day Operations
                </p>
                <h1 className="font-heading text-2xl font-semibold text-foreground">{eventName}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Spatial logistics, live attendance, and fraud-proof checkout
                </p>
              </div>
            </div>
            <nav className="flex flex-wrap gap-1 rounded-xl border border-sage-200 bg-white/90 p-1 shadow-sm">
              {SECTIONS.map(({ id, label, href, icon: Icon }) => {
                const isActive =
                  activeSection === id ||
                  (id === 'operations' && pathname?.includes('/operations')) ||
                  (id === 'wallet' && pathname?.includes('/wallet-topup')) ||
                  (id === 'auctions' && pathname?.includes('/auctions'))
                return (
                  <Link
                    key={id}
                    href={href(eventId)}
                    className={cn(
                      'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 whitespace-nowrap active:translate-y-0.5',
                      isActive
                        ? 'bg-forest text-primary-foreground shadow-[var(--shadow-market)]'
                        : 'text-forest hover:bg-sage-50 hover:scale-[1.02]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}

/** Tab labels used inside the operations hub */
export const OPS_TAB_ICONS = {
  operations: ClipboardList,
  fcfs: ListOrdered,
  clearance: CheckSquare,
}
