'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, User } from 'lucide-react'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/discover', label: 'Discover Markets' },
  { href: '/vendor/events', label: 'For Vendors' },
  { href: '/coordinator/events/new', label: 'Host a Market' },
]

export function GuestNav() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const footer = (
    <>
      <Link href="/login">
        <Button variant="outline" className="w-full min-h-11">
          Sign in
        </Button>
      </Link>
      <Link href="/signup">
        <Button className="w-full min-h-11">Get started</Button>
      </Link>
    </>
  )

  return (
    <nav className="popup-hub-chrome-header sticky top-0 z-50 overflow-x-hidden border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)] safe-top">
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3 xl:max-w-[1600px] xl:px-10">
        <CenteredHeaderRow
          left={
            <BrandLogoLockup className="shrink-0" href="/discover" />
          }
          center={
            <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 overflow-x-hidden md:flex lg:gap-2">
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="shrink-0 rounded-lg px-2 py-2 text-sm font-medium text-foreground transition-colors hover:bg-canvas lg:px-3"
                >
                  {label}
                </Link>
              ))}
            </div>
          }
          right={
            <>
              <Link
                href="/login"
                className="app-tap-target inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                aria-label="Sign in"
              >
                <User className="h-5 w-5 text-foreground" aria-hidden />
              </Link>

              <div className="hidden items-center gap-2 md:flex">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="min-h-9">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="min-h-9">
                    Get started
                  </Button>
                </Link>
              </div>

              <button
                type="button"
                className="app-tap-target flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-stone-200 bg-white hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
                aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>

              <AppMenuSheet
                open={menuOpen}
                onOpenChange={setMenuOpen}
                links={NAV_LINKS}
                pathname={pathname}
                footer={footer}
              />
            </>
          }
        />
      </div>
    </nav>
  )
}
