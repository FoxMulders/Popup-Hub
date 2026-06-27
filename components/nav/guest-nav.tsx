'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, User } from 'lucide-react'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { AppMenuSheet } from '@/components/nav/app-menu-sheet'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { GUEST_RIBBON_LINKS, SITE_HOME_PATH } from '@/components/nav/site-ribbon-links'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
    <nav
      className="popup-hub-chrome-header sticky top-0 z-50 overflow-x-hidden border-b border-stone-200/70 bg-cream/80 backdrop-blur-lg safe-top"
      style={{ minHeight: 'var(--app-nav-height, 3.25rem)' }}
    >
      <div className="mx-auto flex max-w-full overflow-x-hidden px-4 py-2 xl:max-w-[1600px] xl:px-10 sm:py-2.5">
        <CenteredHeaderRow
          centerAlign="start"
          left={
            <BrandLogoLockup className="shrink-0" href={SITE_HOME_PATH} />
          }
          center={
            <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-1 overflow-x-hidden md:flex lg:gap-2">
              {GUEST_RIBBON_LINKS.map(({ href, label, title }) => {
                const active =
                  href === SITE_HOME_PATH
                    ? pathname === SITE_HOME_PATH
                    : pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <Link
                    key={href}
                    href={href}
                    title={title}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-2 text-sm font-medium transition-colors lg:px-4',
                      active
                        ? 'bg-forest/10 text-forest font-semibold'
                        : 'text-foreground/90 hover:bg-canvas/80 hover:text-foreground'
                    )}
                    aria-current={active ? 'page' : undefined}
                  >
                    {label}
                  </Link>
                )
              })}
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
                  <Button variant="outline" size="sm" className="min-h-9 rounded-full px-4">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="min-h-9 rounded-full px-5">
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
                links={GUEST_RIBBON_LINKS}
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
