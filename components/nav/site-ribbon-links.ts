import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { SITE_HOME_PATH } from '@/lib/nav/site-home'

export interface SiteRibbonLink {
  href: string
  label: string
  title?: string
}

/** Patron-facing top ribbon links shared across GuestNav and ShopperTopBar. */
export const GUEST_RIBBON_LINKS: SiteRibbonLink[] = [
  { href: SITE_HOME_PATH, label: 'Home' },
  { href: '/discover', label: 'Discover Markets' },
  {
    href: TRUST_DIRECTORY_LINKS.check.href,
    label: TRUST_DIRECTORY_LINKS.check.label,
    title: TRUST_DIRECTORY_LINKS.check.tagline,
  },
  { href: '/signup?role=vendor', label: 'For Vendors' },
  { href: '/signup?role=coordinator&next=/coordinator/events/new', label: 'Host a Market' },
  { href: '/legal/faq', label: 'FAQ' },
]

/** Logged-in patron ribbon (browse shell). */
export const PATRON_RIBBON_LINKS: SiteRibbonLink[] = [
  { href: SITE_HOME_PATH, label: 'Home' },
  { href: '/discover', label: 'Discover Markets' },
  {
    href: TRUST_DIRECTORY_LINKS.check.href,
    label: TRUST_DIRECTORY_LINKS.check.label,
    title: TRUST_DIRECTORY_LINKS.check.tagline,
  },
  { href: '/favorites', label: 'Favorites' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/legal/faq', label: 'FAQ' },
]

export { SITE_HOME_PATH }
