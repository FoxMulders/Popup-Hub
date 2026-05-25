'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { MobileNavSheet } from '@/components/nav/mobile-nav-sheet'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/discover', label: 'Discover Markets' },
  { href: '/vendor/events', label: 'For Vendors' },
  { href: '/coordinator/events/new', label: 'Host a Market' },
]

export function GuestNav() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-stone-200 bg-cream/95 backdrop-blur-md shadow-[var(--shadow-market)]">
      <div className="mx-auto flex max-w-full items-center justify-between overflow-x-hidden px-4 py-3 xl:max-w-[1600px] xl:px-10">
        <BrandLogoLockup className="shrink-0" href="/discover" />

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
            <Button variant="outline" size="sm" className="min-h-9">
              Sign in
            </Button>
          </Link>
          <Link href="/signup" className="hidden sm:block">
            <Button size="sm" className="min-h-9">
              Get started
            </Button>
          </Link>

          <MobileNavSheet
            links={NAV_LINKS}
            pathname={pathname}
            side="right"
            className="md:hidden"
            footer={
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
            }
          />
        </div>
      </div>
    </nav>
  )
}
