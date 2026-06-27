'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Compass, Heart, User } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/discover', label: 'Discover', icon: Compass },
  { href: '/favorites', label: 'Favorites', icon: Heart },
  { href: '/profile', label: 'Profile', icon: User },
] as const

interface ShopperBottomNavProps {
  hide?: boolean
}

export function ShopperBottomNav({ hide }: ShopperBottomNavProps) {
  const pathname = usePathname()
  const visible = !hide && !pathname.startsWith('/auctions/')

  useEffect(() => {
    if (!visible) return
    document.body.dataset.mobileBottomNav = 'shopper'
    return () => {
      delete document.body.dataset.mobileBottomNav
    }
  }, [visible])

  if (!visible) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-stone-200 bg-cream/95 backdrop-blur-md md:hidden pb-[env(safe-area-inset-bottom)]"
      aria-label="Shopper navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
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
    </nav>
  )
}
