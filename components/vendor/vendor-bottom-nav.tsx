'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Home, Store, Ticket, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SITE_HOME_PATH } from '@/lib/nav/site-home'

const TABS = [
  { href: SITE_HOME_PATH, label: 'Home', icon: Home },
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
  const [mounted, setMounted] = useState(false)
  const visible = !hide && pathname.startsWith('/vendor')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!visible) return
    document.body.dataset.mobileBottomNav = 'vendor'
    return () => {
      delete document.body.dataset.mobileBottomNav
    }
  }, [visible])

  if (!visible || !mounted) return null

  return createPortal(
    <nav
      className="vendor-bottom-chrome fixed inset-x-0 bottom-0 z-50 border-t-2 border-stone-200 bg-cream/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]"
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
                'flex min-h-[3.25rem] min-w-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[10px] font-semibold transition-colors',
                active ? 'text-forest' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-4 w-4', active && 'text-forest')} aria-hidden />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>,
    document.body
  )
}
