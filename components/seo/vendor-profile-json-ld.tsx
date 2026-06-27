import { JsonLdScript } from '@/components/seo/json-ld-script'
import { buildVendorProfileJsonLd } from '@/lib/seo/vendor-profile-json-ld'

type VendorProfileJsonLdProps = {
  eventId: string
  vendorId: string
  businessName: string
  description?: string | null
  logoUrl?: string | null
  categoryName?: string | null
  eventName?: string | null
  websiteUrl?: string | null
  shopUrl?: string | null
  instagramUrl?: string | null
}

export function VendorProfileJsonLd(props: VendorProfileJsonLdProps) {
  return <JsonLdScript data={buildVendorProfileJsonLd(props)} />
}
