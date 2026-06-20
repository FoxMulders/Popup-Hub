import type { VendorPassport } from '@/types/database'
import { resolvePassportCategoryIds } from '@/lib/vendor/passport-categories'
import { displayNameLabel } from '@/lib/passport/requirements'

export interface VendorPassportCompletionStep {
  id: string
  label: string
  required: boolean
  complete: boolean
}

export interface VendorPassportCompletionMeter {
  percent: number
  complete: boolean
  missing: string[]
  steps: VendorPassportCompletionStep[]
}

/** Weighted completion for vendor dashboard — required fields gate applications. */
export function vendorPassportCompletionMeter(
  passport: Pick<
    VendorPassport,
    'business_name' | 'primary_category_id' | 'category_ids' | 'logo_url' | 'bio'
  > | null,
  profileFullName?: string | null
): VendorPassportCompletionMeter {
  const displayName = passport?.business_name?.trim() || profileFullName?.trim() || ''
  const categoryIds = resolvePassportCategoryIds(passport ?? {})

  const steps: VendorPassportCompletionStep[] = [
    {
      id: 'business_name',
      label: displayNameLabel('vendor'),
      required: true,
      complete: Boolean(displayName),
    },
    {
      id: 'categories',
      label: 'At least one product category',
      required: true,
      complete: categoryIds.length > 0,
    },
    {
      id: 'logo',
      label: 'Business logo',
      required: false,
      complete: Boolean(passport?.logo_url),
    },
    {
      id: 'bio',
      label: 'Short bio for organizers',
      required: false,
      complete: Boolean(passport?.bio?.trim()),
    },
  ]

  const weights: Record<string, number> = {
    business_name: 45,
    categories: 45,
    logo: 5,
    bio: 5,
  }

  const percent = steps.reduce(
    (total, step) => total + (step.complete ? (weights[step.id] ?? 0) : 0),
    0
  )

  const missing = steps.filter((step) => step.required && !step.complete).map((step) => step.label)

  return {
    percent,
    complete: missing.length === 0,
    missing,
    steps,
  }
}
