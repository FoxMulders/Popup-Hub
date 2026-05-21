import { redirect } from 'next/navigation'

// Canonical notifications page lives at /notifications
export default function SharedNotificationsRedirect() {
  redirect('/notifications')
}
