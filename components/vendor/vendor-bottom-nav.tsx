'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Store, Ticket, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/vendor/events', label: 'Markets', icon: Store },
  { href: '/vendor/applications', label: 'Applications', icon: ClipboardList },
  { href: '/vendor/passport', label: 'Passport', icon: Ticket },
  { href: '/profile', label: 'Profile', icon: User },
] as const

interface VendorBottomNavProps {
  hide?: boolean
}

export function VendorBottomNav({ hide }: VendorBottomNavProps) {
  const pathname = usePathname()
  const visible = !hide && pathname.startsWith('/vendor')

  useEffect(() => {
    if (!visible) return
    document.body.dataset.mobileBottomNav = 'vendor'
    return () => {
      delete document.body.dataset.mobileBottomNav
    }
  }, [visible])

  if (!visible) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-stone-200 bg-cream/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]"
      aria-label="Vendor navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            pathname.startsWith(`${href}/`) ||
            (href === '/profile' && pathname.startsWith('/profile'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex min-h-[35px] min-w-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[9px] font-semibold transition-colors',
                active ? 'text-violet-900' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'text-violet-700')} aria-hidden />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
