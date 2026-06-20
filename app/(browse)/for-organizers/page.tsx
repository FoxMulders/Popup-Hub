import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import {
  ORGANIZERS_PAGE_DESCRIPTION,
  ORGANIZERS_PAGE_TITLE,
} from '@/lib/seo/site-config'
import { ForOrganizersLanding } from '@/components/public/for-organizers-landing'

export const metadata = buildPublicMetadata({
  title: ORGANIZERS_PAGE_TITLE,
  description: ORGANIZERS_PAGE_DESCRIPTION,
  path: '/for-organizers',
  keywords: [
    'market organizer',
    'market organizer software',
    'market management software',
    'popup market software',
    'makers market management',
    'vendor market platform',
    'farmers market organizer',
    'booth layout software',
  ],
})

export const revalidate = 60

export default function ForOrganizersPage() {
  return <ForOrganizersLanding />
}
