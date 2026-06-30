import Link from 'next/link'
import { PassportWizard } from '@/components/passport/passport-wizard'
import { CoordinatorPassportExtras } from '@/components/passport/coordinator-passport-extras'
import { PassportProfileForm } from '@/components/passport/passport-profile-form'
import { PassportStoriesManager } from '@/components/passport/passport-stories-manager'
import { VendorProductManager } from '@/components/vendor/vendor-product-manager'
import type { PassportPageData } from '@/lib/passport/load-passport-page'
import {
  passportCompletionSummary,
  passportDescription,
  shouldRenderVendorPassportWizard,
  type PassportRouteKind,
} from '@/lib/passport/requirements'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

interface PassportPageViewProps extends PassportPageData {
  passportRoute?: PassportRouteKind
}

export function PassportPageView({
  profile,
  passport,
  categories,
  products,
  passportRoute = 'profile',
}: PassportPageViewProps) {
  const showVendorWizard = shouldRenderVendorPassportWizard(profile, passportRoute)
  const completion = passportCompletionSummary(profile.role, passport, profile)
  const storiesRole = showVendorWizard ? 'vendor' : profile.role

  if (showVendorWizard) {
    return (
      <div className="mx-auto w-full max-w-[1100px] min-w-0 overflow-x-hidden px-4 py-8 pb-44 sm:px-6 sm:pb-8 xl:px-10">
        <div className="mb-8 space-y-3">
          <Link
            href={passportRoute === 'vendor' ? '/vendor/dashboard' : '/profile'}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {passportRoute === 'vendor' ? 'Back to vendor dashboard' : 'Back to profile'}
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
          featuredProductsSlot={
            passport ? (
              <VendorProductManager
                userId={profile.id}
                products={products}
                isBetaTester={profile.is_beta_tester ?? false}
                variant="embedded"
              />
            ) : null
          }
        />
        <div className="mt-8">
          <PassportStoriesManager ownerId={profile.id} role="vendor" />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] min-w-0 overflow-x-hidden px-4 py-8 sm:px-6 xl:px-10">
      <PassportProfileForm profile={profile} existing={passport} />
      {profile.role === 'coordinator' ? (
        <div className="mt-8">
          <CoordinatorPassportExtras />
        </div>
      ) : null}
      <div className="mt-8">
        <PassportStoriesManager ownerId={profile.id} role={storiesRole} />
      </div>
    </div>
  )
}
