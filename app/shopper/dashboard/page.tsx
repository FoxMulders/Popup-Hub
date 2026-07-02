import { redirect } from 'next/navigation'
import { DEFAULT_START_PATH } from '@/lib/nav/site-home'

export default function ShopperDashboardRedirect() {
  redirect(DEFAULT_START_PATH)
}
