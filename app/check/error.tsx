'use client'

import { useEffect } from 'react'
import { TrustDirectoryError } from '@/components/check/trust-directory-error'

export default function CheckPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[check]', error.message, error.digest)
  }, [error])

  return (
    <TrustDirectoryError
      title="Organizer search unavailable"
      message="We could not load the organizer directory right now. This is usually temporary — try again shortly."
    />
  )
}
