import Link from 'next/link'
import { PassportWizard } from '@/components/passport/passport-wizard'
import { PassportProfileForm } from '@/components/passport/passport-profile-form'
import { PassportStoriesManager } from '@/components/passport/passport-stories-manager'
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
      <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 xl:px-10">
        <div className="mb-8 space-y-3">
          <Link
            href="/profile"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to profile
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-bold text-foreground">
              {passport ? 'Update Your Passport' : 'Create Your Vendor Passport'}
            </h1>
            <Badge
              className={
                completion.complete
                  ? 'bg-sage-100 text-sage-800'
                  : 'bg-harvest-100 text-harvest-700'
              }
            >
              {completion.complete ? 'Complete' : 'Incomplete'}
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground">{passportDescription('vendor')}</p>
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
        <div className="mt-8">
          <PassportStoriesManager ownerId={profile.id} role="vendor" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-8 sm:px-6 xl:px-10">
      <PassportProfileForm profile={profile} existing={passport} />
      <div className="mt-8">
        <PassportStoriesManager ownerId={profile.id} role={profile.role} />
      </div>
    </div>
  )
}
