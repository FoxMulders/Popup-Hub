import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

/** Primary marketing links shown in the global site footer. */
export const SITE_FOOTER_MARKETING_LINKS = [
  { href: '/discover', label: 'Discover Markets' },
  { href: '/for-organizers', label: 'For Organizers' },
  { href: '/for-vendors', label: 'For Vendors' },
  {
    href: TRUST_DIRECTORY_LINKS.check.href,
    label: TRUST_DIRECTORY_LINKS.check.navLabel,
  },
  { href: '/legal/about', label: 'About Us' },
] as const

/** Mobile footer — About Us only; full marketing row stays on sm+ */
export const SITE_FOOTER_MOBILE_MARKETING_LINKS = SITE_FOOTER_MARKETING_LINKS.filter(
  (link) => link.href === '/legal/about'
)
