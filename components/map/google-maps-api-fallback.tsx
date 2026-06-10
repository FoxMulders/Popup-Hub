import { AlertTriangle, MapIcon } from 'lucide-react'

interface GoogleMapsApiFallbackProps {
  title?: string
  className?: string
}

/**
 * Shown when the Maps JavaScript API fails to load or the API key is not
 * authorized for Maps / Places / Geocoding.
 */
export function GoogleMapsApiFallback({
  title = 'Google Maps unavailable',
  className,
}: GoogleMapsApiFallbackProps) {
  return (
    <div
      role="alert"
      className={
        className ??
        'flex h-full min-h-[12rem] flex-col items-center justify-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-6 text-center'
      }
    >
      <div className="flex items-center gap-2 text-amber-800">
        <MapIcon className="h-5 w-5 shrink-0" aria-hidden />
        <p className="text-sm font-semibold">{title}</p>
      </div>
      <div className="flex max-w-md items-start gap-2 text-left text-xs text-amber-900/90">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          Verify in Google Cloud Console that <strong>Maps JavaScript API</strong>,{' '}
          <strong>Places API</strong>, and <strong>Geocoding API</strong> are enabled for
          your project key, and that the key is unrestricted or allows this site&apos;s domain.
          If you see &quot;This API key is not authorized to use this service or API&quot;, the
          key is missing one of those APIs or has the wrong HTTP referrer restrictions.
        </p>
      </div>
    </div>
  )
}
