'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Mail } from 'lucide-react'
import { toast } from '@/lib/toast'
import { createClient } from '@/lib/supabase/client'
import { GuestNav } from '@/components/nav/guest-nav'
import { BrandLogoMark } from '@/components/brand/popup-hub-logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { buildOAuthCallbackUrl, getOAuthOrigin } from '@/lib/auth/oauth-callback-url'
import { isEmailConfirmed } from '@/lib/auth/email-confirmation'

function ConfirmEmailForm() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const paramEmail = params.get('email') ?? ''
  const redirectTo = params.get('redirectTo') ?? undefined

  const [email, setEmail] = useState(paramEmail)
  const [resending, setResending] = useState(false)
  const [checking, setChecking] = useState(false)

  async function resendConfirmationEmail() {
    const trimmed = email.trim()
    if (!trimmed) {
      toast.error('Enter the email you used to sign up.')
      return
    }
    setResending(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: trimmed,
      options: {
        emailRedirectTo: buildOAuthCallbackUrl(getOAuthOrigin(), {
          ...(redirectTo ? { next: redirectTo } : {}),
        }),
      },
    })
    setResending(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Confirmation link sent — check your inbox.')
  }

  async function checkConfirmationStatus() {
    setChecking(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setChecking(false)
    if (user && isEmailConfirmed(user)) {
      router.replace(redirectTo ?? '/')
      return
    }
    toast.message('Not confirmed yet — open the link in your email, then try again.')
  }

  return (
    <Card className="marketing-glass-card shadow-[var(--shadow-market-md)]">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-harvest-100 text-harvest-800">
          <Mail className="h-6 w-6" aria-hidden />
        </div>
        <CardTitle className="text-xl">Confirm your email</CardTitle>
        <CardDescription>
          We sent a confirmation link to your inbox. You need to verify before signing in to Popup
          Hub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="confirm-email">Email</Label>
          <Input
            id="confirm-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <Button
          type="button"
          className="w-full min-h-11"
          onClick={() => void resendConfirmationEmail()}
          disabled={resending}
        >
          {resending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Resend confirmation link
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full min-h-11"
          onClick={() => void checkConfirmationStatus()}
          disabled={checking}
        >
          {checking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          I confirmed — continue
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Wrong account?{' '}
          <Link href="/login" className="font-medium text-forest hover:underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function ConfirmEmailPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col site-surface">
      <GuestNav />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-linen via-canvas to-sage-50 p-4 py-10">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-sage-200/50 blur-3xl" />
          <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-harvest-100/60 blur-3xl" />
        </div>
        <div className="relative z-[1] w-full max-w-md space-y-6">
          <div className="text-center">
            <BrandLogoMark size="auth" className="mx-auto" />
          </div>
          <Suspense
            fallback={
              <div className="h-80 animate-pulse rounded-2xl marketing-glass-card bg-white/40" />
            }
          >
            <ConfirmEmailForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
