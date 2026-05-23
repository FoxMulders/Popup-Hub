'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandLogoMark } from '@/components/brand/popup-hub-logo'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'

const NAV_LINKS = [
  { href: '/discover', label: 'Discover Markets' },
  { href: '/vendor/events', label: 'For Vendors' },
  { href: '/coordinator/events/new', label: 'Host a Market' },
]

export function GuestNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)]">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3 xl:px-10">
        <Link href="/discover" className="flex shrink-0 items-center gap-2.5">
          <BrandLogoMark />
          <span className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Popup Hub
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-canvas"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden sm:block">
            <button
              type="button"
              className="h-9 rounded-lg border-2 border-stone-200 px-4 text-sm font-medium text-foreground transition-all hover:bg-canvas active:translate-y-0.5"
            >
              Sign in
            </button>
          </Link>
          <Link href="/signup" className="hidden sm:block">
            <button
              type="button"
              className="btn-tactile h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[var(--shadow-market-lift)] transition-all hover:bg-forest-deep active:translate-y-0.5 active:shadow-none"
            >
              Get started
            </button>
          </Link>

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
                {NAV_LINKS.map(({ href, label }) => (
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
                <Link href="/login">
                  <Button variant="outline" className="mt-4 w-full">
                    Sign in
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button className="w-full">Get started</Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
