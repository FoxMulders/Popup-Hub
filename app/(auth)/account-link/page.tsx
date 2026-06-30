import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BrandLogoMark } from '@/components/brand/popup-hub-logo'
import { GuestNav } from '@/components/nav/guest-nav'
import { AlertTriangle } from 'lucide-react'

type PageProps = {
  searchParams: Promise<{
    email?: string
    duplicateOf?: string
  }>
}

export default async function AccountLinkPage({ searchParams }: PageProps) {
  const params = await searchParams
  const email = params.email?.trim() ?? ''
  const duplicateOf = params.duplicateOf?.trim() ?? ''

  return (
    <>
      <GuestNav />
      <main className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Card className="relative z-[1] w-full max-w-lg marketing-glass-card shadow-[var(--shadow-market-md)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex justify-center">
              <BrandLogoMark size="auth" />
            </div>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertTriangle className="h-6 w-6 text-amber-700" aria-hidden />
            </div>
            <CardTitle className="font-heading text-2xl">Account already exists</CardTitle>
            <CardDescription>
              {email
                ? `An account for ${email} was already created with a different sign-in method.`
                : 'This email is already registered with a different sign-in method.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 leading-relaxed space-y-2">
              <p className="font-medium">To use one Popup Hub account across email and social login:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Sign in with your original method (email and password, or the provider you used first).</li>
                <li>Open Profile → Account Security → Connected sign-in methods.</li>
                <li>Connect Google, Apple, Microsoft, or Facebook from there.</li>
              </ol>
            </div>

            <div className="rounded-xl border bg-canvas/50 px-4 py-3 text-sm text-muted-foreground leading-relaxed space-y-2">
              <p className="font-medium text-foreground">Apple Hide My Email</p>
              <p>
                If you signed up with Apple using a private relay address, it cannot automatically
                merge with your real email account. Sign in to the account that has your admin role
                or market data, then connect Apple from Profile settings.
              </p>
            </div>

            {duplicateOf ? (
              <p className="text-xs text-muted-foreground font-mono break-all">
                Existing account ID: {duplicateOf}
              </p>
            ) : null}

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Link href="/login">
                <Button className="w-full sm:w-auto min-h-11">Sign in to existing account</Button>
              </Link>
              <Link href="/signup?mode=login">
                <Button variant="outline" className="w-full sm:w-auto min-h-11">
                  Back to sign up
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
