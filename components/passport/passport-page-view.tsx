import Link from 'next/link'
import { PassportWizard } from '@/components/passport/passport-wizard'
import { PassportProfileForm } from '@/components/passport/passport-profile-form'
import { VendorProductManager } from '@/components/vendor/vendor-product-manager'
import type { PassportPageData } from '@/lib/passport/load-passport-page'
import {
  passportCompletionSummary,
  passportDescription,
  passportTitle,
} from '@/lib/passport/requirements'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

export function PassportPageView({ profile, passport, categories, products }: PassportPageData) {
  const isVendor = profile.role === 'vendor'
  const completion = passportCompletionSummary(profile.role, passport, profile)

  if (isVendor) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 py-10 xl:px-10">
        <div className="mb-8 space-y-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold text-gray-900">
              {passport ? 'Update Your Passport' : 'Create Your Vendor Passport'}
            </h1>
            <Badge
              className={
                completion.complete
                  ? 'bg-green-100 text-green-800'
                  : 'bg-amber-100 text-amber-800'
              }
            >
              {completion.complete ? 'Complete' : 'Incomplete'}
            </Badge>
          </div>
          <p className="text-lg text-gray-500">{passportDescription('vendor')}</p>
        </div>
        <PassportWizard
          categories={categories}
          existing={passport}
          userId={profile.id}
          redirectAfterSave="/vendor/events"
        />
        {passport ? (
          <VendorProductManager
            userId={profile.id}
            products={products}
            isBetaTester={profile.is_beta_tester ?? false}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10 xl:px-10">
      <PassportProfileForm profile={profile} existing={passport} />
    </div>
  )
}
