import { redirect } from 'next/navigation'

export default function SquareConnectRedirectPage() {
  redirect('/coordinator/payment-methods')
}
