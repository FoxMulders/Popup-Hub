'use client'

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
  if (hide || pathname.startsWith('/auctions/')) return null

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
                'flex min-h-[52px] min-w-[72px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-2 text-[10px] font-semibold transition-colors',
                active ? 'text-forest' : 'text-muted-foreground'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-forest')} aria-hidden />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
