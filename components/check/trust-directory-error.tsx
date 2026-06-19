import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SITE_HOME_PATH } from '@/lib/nav/site-home'
import { TRUST_DIRECTORY_LINKS } from '@/lib/nav/trust-directory-nav'

interface TrustDirectoryErrorProps {
  title?: string
  message?: string
}

export function TrustDirectoryError({
  title = 'Something went wrong',
  message = 'We could not load this page right now. The organizer directory may still be setting up — try again in a moment or return home.',
}: TrustDirectoryErrorProps) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center space-y-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="text-xl font-bold text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Link href={SITE_HOME_PATH}>
          <Button>Go to Home</Button>
        </Link>
        <Link href="/check">
          <Button variant="outline">{TRUST_DIRECTORY_LINKS.check.label}</Button>
        </Link>
      </div>
    </div>
  )
}
