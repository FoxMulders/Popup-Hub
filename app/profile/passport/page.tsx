import { PassportPageView } from '@/components/passport/passport-page-view'
import { loadPassportPageData } from '@/lib/passport/load-passport-page'

export default async function ProfilePassportPage() {
  const data = await loadPassportPageData()
  return <PassportPageView {...data} />
}
