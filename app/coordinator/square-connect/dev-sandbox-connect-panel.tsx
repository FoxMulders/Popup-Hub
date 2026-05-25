import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function DevSandboxConnectPanel() {
  return (
    <div className="rounded-lg border border-dashed border-muted-foreground/40 bg-muted/30 p-4 space-y-2">
      <p className="text-sm font-medium text-foreground">Dev shortcut (skip OAuth)</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Square Sandbox OAuth often shows a blank page even with the seller dashboard open. For local
        payment testing, copy a fresh <strong>Sandbox access token</strong> for your seller test
        account into <code className="rounded bg-muted px-1">SQUARE_ACCESS_TOKEN</code> in{' '}
        <code className="rounded bg-muted px-1">.env.local</code>, restart{' '}
        <code className="rounded bg-muted px-1">npm run dev</code>, then connect below.
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground leading-relaxed">
        <li>Square Developer Console → Sandbox test accounts → The Tipsy Fox (or your seller)</li>
        <li>Copy <strong>Access token</strong> (not Application secret)</li>
        <li>Paste into <code className="rounded bg-muted px-1">SQUARE_ACCESS_TOKEN</code> and restart dev server</li>
      </ol>
      <Link href="/api/dev/connect-square-sandbox" className="inline-block">
        <Button type="button" variant="secondary" size="sm">
          Connect using .env sandbox token
        </Button>
      </Link>
    </div>
  )
}
