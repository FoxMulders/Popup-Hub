'use client'

/**
 * Loads the Google Maps JavaScript API via @vis.gl/react-google-maps.
 *
 * Authorization / restriction errors (RefererNotAllowedMapError, ApiNotActivatedMapError,
 * "This API key is not authorized…") usually mean the Cloud Console key is missing one of:
 * Maps JavaScript API, Places API, or Geocoding API — or HTTP referrer restrictions block this origin.
 * {@link GoogleMapsApiFallback} renders a friendly admin warning when load fails.
 */

import { useEffect, useState, type ReactNode } from 'react'
import { APIProvider, useApiIsLoaded, type APIProviderProps } from '@vis.gl/react-google-maps'
import { GoogleMapsApiFallback } from '@/components/map/google-maps-api-fallback'
import { Loader2 } from 'lucide-react'

const MAPS_AUTH_ERROR_PATTERNS = [
  /Google Maps JavaScript API error/i,
  /This API key is not authorized/i,
  /ApiNotActivatedMapError/i,
  /RefererNotAllowedMapError/i,
  /InvalidKeyMapError/i,
]

interface GoogleMapsProviderProps {
  apiKey: string
  libraries?: APIProviderProps['libraries']
  children: ReactNode
  fallback?: ReactNode
  loading?: ReactNode
}

function MapsApiLoadGuard({
  children,
  fallback,
  loading,
}: {
  children: ReactNode
  fallback: ReactNode
  loading: ReactNode
}) {
  const apiLoaded = useApiIsLoaded()
  const [authError, setAuthError] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    function handleError(event: ErrorEvent) {
      const message = event.message ?? ''
      if (MAPS_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
        setAuthError(true)
      }
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const reason = String(event.reason ?? '')
      if (MAPS_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(reason))) {
        setAuthError(true)
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleRejection)
    }
  }, [])

  useEffect(() => {
    if (apiLoaded) {
      setTimedOut(false)
      return
    }

    const timer = window.setTimeout(() => setTimedOut(true), 12_000)
    return () => window.clearTimeout(timer)
  }, [apiLoaded])

  if (authError || timedOut) return <>{fallback}</>
  if (!apiLoaded) return <>{loading}</>
  return <div className="h-full w-full">{children}</div>
}

const defaultLoading = (
  <div className="flex h-full min-h-[280px] items-center justify-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    Loading map…
  </div>
)

export function GoogleMapsProvider({
  apiKey,
  libraries,
  children,
  fallback,
  loading = defaultLoading,
}: GoogleMapsProviderProps) {
  const resolvedFallback = fallback ?? <GoogleMapsApiFallback />

  if (!apiKey.trim()) {
    return <>{resolvedFallback}</>
  }

  return (
    <APIProvider apiKey={apiKey} libraries={libraries}>
      <MapsApiLoadGuard fallback={resolvedFallback} loading={loading}>
        {children}
      </MapsApiLoadGuard>
    </APIProvider>
  )
}
