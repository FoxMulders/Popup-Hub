import { redirect } from 'next/navigation'

/** Legacy path — wallet lives at /wallet. */
export default function SharedWalletRedirect() {
  redirect('/wallet')
}
