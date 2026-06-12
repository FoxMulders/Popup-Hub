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
          In Google Cloud Console → APIs &amp; Services → your API key →{' '}
          <strong>API restrictions</strong>, enable{' '}
          <strong>Maps JavaScript API</strong>, <strong>Places API</strong>, and{' '}
          <strong>Geocoding API</strong>. Under <strong>Application restrictions</strong> (HTTP
          referrers), allow <code className="text-[10px]">https://popuphub.ca/*</code>,{' '}
          <code className="text-[10px]">https://*.vercel.app/*</code>, and{' '}
          <code className="text-[10px]">http://localhost:*</code>. Set{' '}
          <code className="text-[10px]">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> on Vercel (or{' '}
          <code className="text-[10px]">GOOGLE_MAPS_API_KEY</code>).
        </p>
      </div>
    </div>
  )
}
