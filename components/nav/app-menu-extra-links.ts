import type { AppMenuLink } from '@/components/nav/app-menu-sheet'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'
import { canActAsVendor } from '@/lib/auth/rbac'
import type { Profile } from '@/types/database'
import type { AdminPendingCounts } from '@/hooks/use-admin-pending-counts'

/** Slide-out menu links below primary nav (profile + optional admin console). */
export function buildAppMenuExtraLinks(
  profile: Pick<Profile, 'role' | 'is_admin'>,
  adminPending?: Pick<AdminPendingCounts, 'total'>
): AppMenuLink[] {
  const trustLinks: AppMenuLink[] = canActAsVendor(profile)
    ? [{ href: TRUST_DIRECTORY_LINKS.review.href, label: TRUST_DIRECTORY_LINKS.review.label }]
    : []

  return [
    ...trustLinks,
    { href: '/profile', label: 'Profile settings' },
    ...(profile.is_admin
      ? [{
          href: '/admin/feedback',
          label: 'Admin console',
          badgeCount: adminPending?.total,
        }]
      : []),
  ]
}
