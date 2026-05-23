import type { Role } from '@/types/database'

export function roleDocumentTitle(role: Role | null | undefined): string {
  switch (role) {
    case 'coordinator':
      return 'Popup Hub - Coordinator'
    case 'vendor':
      return 'Popup Hub - Vendor'
    case 'shopper':
      return 'Popup Hub - Patron'
    default:
      return 'Popup Hub'
  }
}
