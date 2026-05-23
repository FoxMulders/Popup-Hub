'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MapPin, Menu, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { PortalSwitcherMenuItems } from '@/components/nav/portal-switcher'
import type { Profile } from '@/types/database'

interface ShopperTopBarProps {
  profile: Profile | null
  vendorAccessCount?: number
}

export function ShopperTopBar({ profile, vendorAccessCount = 0 }: ShopperTopBarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const initials =
    (profile?.full_name || ' ')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/discover')
    router.refresh()
  }

  const navLinks = [
    { href: '/discover', label: 'Discover Markets' },
    { href: '/favorites', label: 'Favorites' },
    { href: '/wallet', label: 'Wallet' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/discover" className="flex shrink-0 items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest shadow-[var(--shadow-market-lift)]">
            <MapPin className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-heading text-lg font-semibold tracking-tight text-foreground sm:text-xl">
            Popup Hub
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ href, label }) => (
            <Link key={href} href={href}>
              <Button
                variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 text-sm"
              >
                {label}
              </Button>
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button className="h-9 w-9 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-sage-100 text-xs font-bold text-forest">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                <div className="border-b px-3 py-2">
                  <p className="truncate text-sm font-semibold">{profile.full_name}</p>
                </div>
                <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/wallet')} className="cursor-pointer">
                  Wallet
                </DropdownMenuItem>
                <PortalSwitcherMenuItems
                  hasVendorAccess={vendorAccessCount > 0}
                  currentPortal="markets"
                />
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm" className="hidden sm:inline-flex">
                  Get started
                </Button>
              </Link>
            </>
          )}

          <Sheet>
            <SheetTrigger
              render={
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-canvas md:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              }
            />
            <SheetContent side="right" className="w-72">
              <div className="mt-8 flex flex-col gap-1">
                {navLinks.map(({ href, label }) => (
                  <Link key={href} href={href}>
                    <Button
                      variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                      size="sm"
                    >
                      {label}
                    </Button>
                  </Link>
                ))}
                {!profile && (
                  <>
                    <Link href="/login">
                      <Button variant="outline" className="mt-4 w-full">
                        Sign in
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button className="w-full">Get started</Button>
                    </Link>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
