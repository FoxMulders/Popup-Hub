import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import {
  COMPARE_PAGE_DESCRIPTION,
  COMPARE_PAGE_TITLE,
} from '@/lib/seo/site-config'
import { CompareLanding } from '@/components/public/compare-landing'

export const metadata = buildPublicMetadata({
  title: COMPARE_PAGE_TITLE,
  description: COMPARE_PAGE_DESCRIPTION,
  path: '/compare',
  keywords: [
    'market advertising',
    'event marketing',
    'local market promotion',
    'farmers market advertising',
    'makers market marketing',
    'hyperlocal marketing',
    'market organizer',
    'popup market discovery',
  ],
})

export const revalidate = 60

export default function ComparePage() {
  return <CompareLanding />
}
