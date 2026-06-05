import type { Profile, Role, VendorPassport } from '@/types/database'
import { isPassportReadyForApplication } from '@/lib/vendor/passport-application'

export const PASSPORT_PATH = '/profile/passport'

export type PassportField =
  | 'display_name'
  | 'bio'
  | 'categories'
  | 'tax_id'
  | 'logo'
  | 'product_photos'
  | 'online_presence'
  | 'phone'

export function requiredPassportFields(role: Role): PassportField[] {
  switch (role) {
    case 'vendor':
      return ['display_name', 'categories']
    case 'coordinator':
      return ['display_name']
    case 'shopper':
    default:
      return ['display_name']
  }
}

export function optionalPassportFields(role: Role): PassportField[] {
  switch (role) {
    case 'vendor':
      return ['bio', 'tax_id', 'logo', 'product_photos', 'online_presence']
    case 'coordinator':
      return ['bio', 'online_presence']
    case 'shopper':
    default:
      return ['bio', 'online_presence']
  }
}

export function passportTitle(role: Role): string {
  switch (role) {
    case 'vendor':
      return 'Vendor Passport'
    case 'coordinator':
      return 'Coordinator Passport'
    case 'shopper':
    default:
      return 'Patron Passport'
  }
}

export function passportDescription(role: Role): string {
  switch (role) {
    case 'vendor':
      return 'Your passport is your universal business identity across all Popup Hub markets.'
    case 'coordinator':
      return 'Your public identity when organizing markets on Popup Hub.'
    case 'shopper':
    default:
      return 'Your Popup Hub identity for markets, auctions, and vendor contact preferences.'
  }
}

export function displayNameLabel(role: Role): string {
  switch (role) {
    case 'vendor':
      return 'Business Name'
    case 'coordinator':
      return 'Display Name'
    case 'shopper':
    default:
      return 'Display Name'
  }
}

export function isPassportCompleteForRole(
  role: Role,
  passport: Pick<VendorPassport, 'business_name' | 'primary_category_id' | 'category_ids'> | null | undefined,
  profile?: Pick<Profile, 'full_name'> | null
): boolean {
  const displayName = passport?.business_name?.trim() || profile?.full_name?.trim()
  if (!displayName) return false

  if (role === 'vendor') {
    return isPassportReadyForApplication(passport)
  }

  return true
}

export function passportCompletionSummary(
  role: Role,
  passport: Pick<VendorPassport, 'business_name' | 'primary_category_id' | 'category_ids'> | null | undefined,
  profile?: Pick<Profile, 'full_name'> | null
): { complete: boolean; missing: string[] } {
  const missing: string[] = []
  const displayName = passport?.business_name?.trim() || profile?.full_name?.trim()

  if (!displayName) {
    missing.push(displayNameLabel(role))
  }

  if (role === 'vendor' && !isPassportReadyForApplication(passport)) {
    if (displayName && missing.length === 0) {
      missing.push('At least one business category')
    }
  }

  return { complete: missing.length === 0, missing }
}
