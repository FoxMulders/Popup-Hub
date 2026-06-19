'use client'

import { useEffect } from 'react'
import { TrustDirectoryError } from '@/components/check/trust-directory-error'

export default function OrganizerPageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[organizers/slug]', error.message, error.digest)
  }, [error])

  return (
    <TrustDirectoryError
      title="Organizer profile unavailable"
      message="This organizer page could not be loaded. If you followed a link from search, try again — or check that the trust directory is available."
    />
  )
}
