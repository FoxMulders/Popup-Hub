import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { VENDORS_PAGE_DESCRIPTION, VENDORS_PAGE_TITLE } from '@/lib/seo/site-config'
import { ForVendorsLanding } from '@/components/public/for-vendors-landing'

export const metadata = buildPublicMetadata({
  title: VENDORS_PAGE_TITLE,
  description: VENDORS_PAGE_DESCRIPTION,
  path: '/for-vendors',
  keywords: [
    'vendor market application',
    'apply to makers market',
    'artisan market vendor',
    'craft fair vendor application',
    'vendor passport',
    'popup market vendor',
    'HubGuard',
    'booth fees',
  ],
})

export const revalidate = 60

export default function ForVendorsPage() {
  return <ForVendorsLanding />
}
