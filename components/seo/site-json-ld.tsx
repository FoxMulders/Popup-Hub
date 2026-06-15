import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/seo/organization-json-ld'
import { JsonLdScript } from '@/components/seo/json-ld-script'

/** Global Organization + WebSite structured data for all public pages. */
export function SiteJsonLd() {
  return <JsonLdScript data={[buildOrganizationJsonLd(), buildWebSiteJsonLd()]} />
}
