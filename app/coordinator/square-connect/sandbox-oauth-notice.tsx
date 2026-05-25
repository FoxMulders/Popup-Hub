import { ExternalLink } from 'lucide-react'
import { SQUARE_SANDBOX_SELLER_DASHBOARD_URL } from '@/lib/square/connect-url'

export function SandboxSquareOAuthNotice() {
  return (
    <div className="rounded-lg border border-harvest-300 bg-harvest-50 p-4 text-sm text-harvest-900 space-y-2">
      <p className="font-medium">Sandbox OAuth: sign in to Square first</p>
      <p className="text-harvest-800/90 text-xs leading-relaxed">
        A blank page at <code className="rounded bg-white/70 px-1">squareupsandbox.com/oauth2/authorize</code>{' '}
        usually means you are not signed in to a Sandbox <strong>seller</strong> account. Open the Sandbox
        Seller Dashboard in another tab, sign in with your test seller, then click Connect with Square again.
      </p>
      <a
        href={SQUARE_SANDBOX_SELLER_DASHBOARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-harvest-800 underline underline-offset-2 hover:text-harvest-950"
      >
        Open Sandbox Seller Dashboard
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
      <p className="text-xs text-harvest-800/80">
        In the Square Developer Console (Sandbox mode), register your redirect URL under OAuth exactly as shown
        below — including <code className="rounded bg-white/60 px-1">https</code> and no trailing slash.
      </p>
    </div>
  )
}
