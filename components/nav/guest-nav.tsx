'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandLogoLockup } from '@/components/brand/popup-hub-logo'
import { CenteredHeaderRow } from '@/components/nav/centered-header-row'
import { UserProfileMenu } from '@/components/nav/user-profile-menu'
import { Button } from '@/components/ui/button'

const NAV_LINKS = [
  { href: '/discover', label: 'Discover Markets' },
  { href: '/vendor/events', label: 'For Vendors' },
  { href: '/coordinator/events/new', label: 'Host a Market' },
]

export function GuestNav() {
  const pathname = usePathname()

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
      <div className="mx-auto flex max-w-full flex-col gap-2 overflow-x-hidden px-4 py-3.5 xl:max-w-[1600px] xl:px-10">
        <CenteredHeaderRow
          left={null}
          center={
            <BrandLogoLockup
              className="h-14 w-auto max-h-14 sm:h-16 sm:max-h-16 md:h-18 md:max-h-none"
              href="/discover"
            />
          }
          right={
            <>
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

              <UserProfileMenu
                links={NAV_LINKS}
                pathname={pathname}
                footer={footer}
                guest
              />
            </>
          }
        />
      </div>
    </nav>
  )
}
