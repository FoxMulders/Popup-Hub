import type { AppMenuLink } from '@/components/nav/app-menu-sheet'
import type { Profile } from '@/types/database'

/** Slide-out menu links below primary nav (profile + optional admin console). */
export function buildAppMenuExtraLinks(profile: Pick<Profile, 'is_admin'>): AppMenuLink[] {
  return [
    { href: '/profile', label: 'Profile settings' },
    ...(profile.is_admin
      ? [
          { href: '/admin/feedback', label: 'Feature requests' },
          { href: '/admin/feedback', label: '🛠️ Admin Console' },
        ]
      : []),
  ]
}
