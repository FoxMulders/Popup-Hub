const SQUARE_DEVELOPER_CONSOLE_URL = 'https://developer.squareup.com/console/en/apps'

export function SandboxSquareOAuthNotice() {
  return (
    <div className="rounded-lg border border-harvest-300 bg-harvest-50 p-4 text-sm text-harvest-900 space-y-2">
      <p className="font-medium">Sandbox OAuth: launch a test seller first</p>
      <p className="text-harvest-800/90 text-xs leading-relaxed">
        A blank or white page at{' '}
        <code className="rounded bg-white/70 px-1">squareupsandbox.com/oauth2/authorize</code> means Square has
        no active Sandbox seller session. You cannot log in on that page directly — launch the seller from the
        Developer Console first.
      </p>
      <ol className="list-decimal space-y-1 pl-4 text-xs text-harvest-800/90 leading-relaxed">
        <li>
          Open the{' '}
          <a
            href={SQUARE_DEVELOPER_CONSOLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2 hover:text-harvest-950"
          >
            Square Developer Console
          </a>{' '}
          and select your app.
        </li>
        <li>
          Go to <strong>Sandbox test accounts</strong> → choose a seller →{' '}
          <strong>Open in Square Dashboard</strong>.
        </li>
        <li>Leave that Sandbox dashboard tab open.</li>
        <li>Return here and click Connect with Square again — you should see an Allow / Authorize screen.</li>
      </ol>
      <p className="text-xs text-harvest-800/80">
        In the Developer Console (Sandbox → OAuth), register the redirect URL exactly as shown below — same
        scheme, host, and path, with no trailing slash.
      </p>
    </div>
  )
}
