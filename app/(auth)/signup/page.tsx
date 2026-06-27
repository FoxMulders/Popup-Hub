'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BrandLogoMark } from '@/components/brand/popup-hub-logo'
import { GuestNav } from '@/components/nav/guest-nav'
import { Loader2, ShoppingBag, Calendar, Store } from 'lucide-react'
import { toast } from 'sonner'
import { type SignupRole } from '@/lib/auth/rbac'
import {
  onNativeOAuthBrowserFinished,
  signInWithGoogleOAuth,
} from '@/lib/auth/native-oauth'
import { buildOAuthCallbackUrl, getOAuthOrigin } from '@/lib/auth/oauth-callback-url'
import { marketStatusBadge } from '@/lib/theme/market'
import { LoginForm } from '@/app/(auth)/login/login-form'
import { VendorSignupPassportPreview } from '@/components/marketing/vendor-signup-passport-preview'

const ROLE_OPTIONS = [
  {
    id: 'shopper' as SignupRole,
    label: 'Patron',
    desc: 'Discover markets, maps & favorites',
    icon: ShoppingBag,
  },
  {
    id: 'vendor' as SignupRole,
    label: 'Vendor',
    desc: 'Apply for booths — juried markets review each application',
    icon: Store,
  },
  {
    id: 'coordinator' as SignupRole,
    label: 'Coordinator',
    desc: 'Create events & manage vendors',
    icon: Calendar,
  },
] as const

function defaultPostSignupPath(role: SignupRole): string | undefined {
  if (role === 'coordinator') return '/coordinator/events/new'
  if (role === 'vendor') return '/vendor/dashboard'
  return undefined
}

function isSignupRole(value: string | null): value is SignupRole {
  return value === 'shopper' || value === 'vendor' || value === 'coordinator'
}

function SignupForm() {
  const params = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const paramRole = params.get('role')
  const paramMode = params.get('mode')
  const paramNext = params.get('next') ?? params.get('redirectTo')
  const roleLocked = isSignupRole(paramRole)
  const defaultRole: SignupRole = roleLocked ? paramRole : 'shopper'

  const [authMode, setAuthMode] = useState<'signup' | 'login'>(
    paramMode === 'login' ? 'login' : 'signup'
  )

  const [role, setRole] = useState<SignupRole>(defaultRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleOAuthPending, setGoogleOAuthPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [resending, setResending] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [shareContactWithVendors, setShareContactWithVendors] = useState(false)

  const canSubmit = termsAccepted && !loading && !googleOAuthPending

  useEffect(() => {
    const code = params.get('code')
    if (!code) return

    const search = new URLSearchParams(params.toString())
    search.delete('redirectTo')
    window.location.replace(`/api/auth/callback?${search.toString()}`)
  }, [params])

  useEffect(() => {
    if (!paramNext) return

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace(paramNext)
      }
    })
  }, [paramNext, router, supabase])

  const postSignupPath = paramNext ?? defaultPostSignupPath(role)

  useEffect(() => {
    onNativeOAuthBrowserFinished((reason) => {
      setGoogleOAuthPending(false)
      if (reason === 'cancelled') {
        toast.message('Sign-in was cancelled.')
      }
    })
    return () => {
      onNativeOAuthBrowserFinished(null)
    }
  }, [])

  async function handleGoogleSignUp() {
    if (!termsAccepted || googleOAuthPending) {
      if (!termsAccepted) {
        toast.error('Please accept the terms and conditions first.')
      }
      return
    }
    localStorage.setItem('signup_role', role)
    if (role === 'shopper') {
      document.cookie = `signup_share_contact=${shareContactWithVendors ? '1' : '0'}; path=/; max-age=600; SameSite=Lax`
    }
    setGoogleOAuthPending(true)

    const result = await signInWithGoogleOAuth(supabase, {
      role,
      ...(postSignupPath ? { next: postSignupPath } : {}),
    })

    if (result.mode === 'error') {
      setGoogleOAuthPending(false)
      toast.error(result.message)
      return
    }

    if (result.mode === 'redirect') {
      setGoogleOAuthPending(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!termsAccepted) {
      toast.error('Please accept the terms and conditions first.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
          ...(role === 'shopper'
            ? { share_contact_with_vendors: shareContactWithVendors }
            : {}),
        },
        emailRedirectTo: buildOAuthCallbackUrl(getOAuthOrigin(), {
          role,
          ...(postSignupPath ? { next: postSignupPath } : {}),
        }),
      },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    await supabase.auth.signOut()
    setSubmitted(true)
    setLoading(false)
  }

  async function resendConfirmationEmail() {
    if (!email.trim()) return
    setResending(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      options: {
        emailRedirectTo: buildOAuthCallbackUrl(getOAuthOrigin(), {
          role,
          ...(postSignupPath ? { next: postSignupPath } : {}),
        }),
      },
    })
    setResending(false)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Confirmation link sent again — check your inbox.')
  }

  const selectedLabel = ROLE_OPTIONS.find((option) => option.id === role)?.label ?? role
  const signupTitle =
    roleLocked && role === 'coordinator'
      ? 'Start hosting your market'
      : roleLocked && role === 'vendor'
        ? 'Create your vendor account'
        : 'Create your account'
  const signupDescription =
    roleLocked && role === 'coordinator'
      ? 'Set up events, review applications, and run market day from one hub.'
      : roleLocked && role === 'vendor'
        ? paramNext
          ? 'Sign up, then we’ll take you straight to the market to apply.'
          : 'Apply to open markets and manage your vendor passport.'
        : 'Choose how you\'ll use Popup Hub'

  if (submitted) {
    return (
      <Card className="relative z-[1] w-full max-w-md marketing-glass-card shadow-[var(--shadow-market-md)] text-center">
        <CardContent className="pt-10 pb-8 px-8">
          <div className="mx-auto mb-3 flex justify-center">
            <BrandLogoMark size="auth" />
          </div>
          <h2 className="font-heading text-2xl font-semibold text-foreground mb-2">Check your email</h2>
          <p className="text-muted-foreground mb-1">
            We sent a confirmation link to
          </p>
          <p className="font-semibold text-foreground mb-6">{email}</p>
          <p className="text-sm text-muted-foreground mb-6">
            Open the confirmation link in that email to activate your Popup Hub account as a{' '}
            <span className="font-medium text-foreground">{selectedLabel}</span>. This is a link in
            the email, not a numeric code.
          </p>
          <div className={`rounded-xl p-4 text-sm space-y-3 ${marketStatusBadge.warning}`}>
            <p>
              Can&apos;t find it? Check your spam folder, wait a few minutes, or resend the link
              below.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10"
                disabled={resending}
                onClick={() => void resendConfirmationEmail()}
              >
                {resending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Resend confirmation link
              </Button>
              <button
                type="button"
                className="text-sm underline font-medium"
                onClick={() => setSubmitted(false)}
              >
                Use a different email
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="relative z-[1] flex w-full max-w-lg flex-col marketing-glass-card shadow-[var(--shadow-market-md)]">
      <CardHeader className="text-center">
        <div className="mb-4 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={authMode === 'signup' ? 'default' : 'outline'}
            className="min-h-11 touch-manipulation"
            onClick={() => setAuthMode('signup')}
          >
            Create account
          </Button>
          <Button
            type="button"
            variant={authMode === 'login' ? 'default' : 'outline'}
            className="min-h-11 touch-manipulation"
            onClick={() => setAuthMode('login')}
          >
            Sign in
          </Button>
        </div>
        {authMode === 'signup' ? (
          <>
            <CardTitle className="font-heading text-2xl">{signupTitle}</CardTitle>
            <CardDescription>{signupDescription}</CardDescription>
          </>
        ) : (
          <>
            <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your Popup Hub account</CardDescription>
          </>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {authMode === 'login' ? (
          <>
            <LoginForm embedded />
            <p className="mt-4 text-center text-xs text-muted-foreground leading-relaxed">
              New here? Create an account first — we email a confirmation <strong>link</strong> (not
              a code). If sign-in fails, check your inbox for that link or use Resend after signing
              up.
            </p>
          </>
        ) : (
          <>
          {!roleLocked ? (
            <fieldset className="mb-6">
              <legend className="mb-2 block text-sm font-medium">I am a… *</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {ROLE_OPTIONS.map(({ id, label, desc, icon: Icon }) => {
                  const selected = role === id
                  return (
                    <label
                      key={id}
                      className={`flex min-h-[4.5rem] cursor-pointer touch-manipulation flex-col items-center rounded-xl border p-3 text-center transition ${
                        selected
                          ? 'border-harvest-500 bg-harvest-50 ring-2 ring-harvest-200/80'
                          : 'border-stone-200/80 hover:border-harvest-400/60 hover:bg-canvas/50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="signup-role"
                        value={id}
                        checked={selected}
                        onChange={() => setRole(id)}
                        className="sr-only"
                        required
                      />
                      <Icon
                        className={`mb-1.5 h-5 w-5 ${selected ? 'text-harvest-600' : 'text-muted-foreground'}`}
                      />
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{desc}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : (
            <div className="mb-6 flex justify-center">
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
                {role === 'coordinator' ? (
                  <Calendar className="h-4 w-4" aria-hidden />
                ) : (
                  <Store className="h-4 w-4" aria-hidden />
                )}
                Signing up as {selectedLabel}
              </Badge>
            </div>
          )}
          {!roleLocked ? (
            <p className="mb-4 text-xs text-muted-foreground leading-snug">
              Vendors can sign up directly and apply to open markets. Organizers only review applications
              for <strong>juried</strong> events — instant-book markets approve automatically.
            </p>
          ) : null}
          {role === 'vendor' ? <VendorSignupPassportPreview /> : null}
          <form onSubmit={handleSignup} className="flex flex-col space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" placeholder="Jane Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <label className="flex items-start gap-2 rounded-lg border bg-white px-3 py-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 touch-manipulation"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span>
                I agree to the{' '}
                <Link href="/legal/terms" className="font-medium text-forest underline" target="_blank">
                  Terms &amp; Conditions
                </Link>{' '}
                and{' '}
                <Link href="/legal/privacy" className="font-medium text-forest underline" target="_blank">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
            {role === 'shopper' && (
              <label className="flex items-start gap-2 rounded-lg border border-sage-200 bg-sage-50/50 px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 touch-manipulation"
                  checked={shareContactWithVendors}
                  onChange={(e) => setShareContactWithVendors(e.target.checked)}
                />
                <span>
                  <span className="font-medium">Share contact info with vendors</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    When enabled, donating vendors can see your name, email, and phone after you win a quarter auction item.
                  </span>
                </span>
              </label>
            )}
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 gap-2 touch-manipulation"
              onClick={handleGoogleSignUp}
              disabled={!termsAccepted || googleOAuthPending}
            >
              {googleOAuthPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>
            <div className="sticky bottom-0 bg-white pt-2">
              <Button type="submit" className="w-full min-h-11 touch-manipulation" disabled={!canSubmit}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Account as <Badge className="ml-1 bg-white/20 text-white">{selectedLabel}</Badge>
              </Button>
            </div>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              className="font-semibold text-forest hover:underline"
              onClick={() => setAuthMode('login')}
            >
              Sign in
            </button>
          </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default function SignupPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col site-surface">
      <GuestNav />
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-linen via-canvas to-sage-50 p-4 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-sage-200/50 blur-3xl" />
        <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-harvest-100/60 blur-3xl" />
      </div>
      <Suspense fallback={<div className="relative z-[1] w-full max-w-lg h-[32rem] animate-pulse marketing-glass-card rounded-2xl" />}>
        <div className="relative z-[1]">
          <SignupForm />
        </div>
      </Suspense>
      </div>
    </div>
  )
}
