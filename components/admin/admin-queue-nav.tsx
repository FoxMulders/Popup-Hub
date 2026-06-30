'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAdminPendingCounts } from '@/hooks/use-admin-pending-counts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const QUEUE_LINKS = [
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/feedback', label: 'Feature requests', countKey: 'featureRequests' as const },
  { href: '/admin/organizer-claims', label: 'Organizer claims', countKey: 'organizerClaims' as const },
  { href: '/admin/publish-assist', label: 'Publish assist', countKey: 'publishAssist' as const },
  { href: '/admin/venues', label: 'Venue submissions', countKey: 'venueSubmissions' as const },
]

export function AdminQueueNav() {
  const pathname = usePathname()
  const { counts } = useAdminPendingCounts(true)

  return (
    <nav aria-label="Admin queues" className="-mx-1 overflow-x-auto pb-1">
      <div className="inline-flex h-auto w-max min-w-full flex-nowrap gap-1 rounded-xl border border-border bg-card/90 p-1 shadow-sm">
        {QUEUE_LINKS.map(({ href, label, countKey }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`)
          const pending = countKey ? counts[countKey] : 0

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-all duration-200 active:translate-y-0.5',
                isActive
                  ? 'bg-forest text-primary-foreground shadow-[var(--shadow-market)]'
                  : 'text-foreground hover:bg-muted/60'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              {label}
              {pending > 0 ? (
                <Badge
                  className={cn(
                    'h-5 min-w-5 px-1.5 text-[10px] leading-none',
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : ''
                  )}
                >
                  {pending > 9 ? '9+' : pending}
                </Badge>
              ) : null}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
