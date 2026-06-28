'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  onNativeOAuthBrowserFinished,
  signInWithOAuth,
} from '@/lib/auth/native-oauth'
import { type OAuthProviderId } from '@/lib/auth/oauth-providers'
import { OAuthProviderButtons } from '@/components/auth/oauth-provider-buttons'
import { isEmailNotConfirmedAuthError } from '@/lib/auth/email-confirmation'
import { resolvePostLoginPath } from '@/lib/auth/post-login-redirect'
import {
  clearNedryLockoutState,
  formatLockoutCountdown,
  lockoutSecondsForStrike,
  normalizeLoginCredential,
  readNedryLockoutState,
  remainingLockoutSeconds,
  validateLoginCredentials,
  writeNedryLockoutState,
} from '@/src/qa_review/lib/auth/login-lockout_qa'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

const MAGIC_WORD_VIDEO = '/assets/nedry_magic_word.mp4'
const MAGIC_WORD_GIF = '/assets/nedry.gif'

/**
 * QA staging login — trimmed credential handling, local-only password visibility,
 * 3-strike exponential lockout, and Jurassic Park Nedry denial overlay.
 */
export function LoginQa({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? searchParams.get('next') ?? '/discover'
  const authError = searchParams.get('error')
  const authErrorDetail = searchParams.get('detail')
  const supabase = createClient()
  const passwordInputId = useId()
  const passwordToggleId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthPendingProvider, setOauthPendingProvider] = useState<OAuthProviderId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [strikes, setStrikes] = useState(0)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [useGifFallback, setUseGifFallback] = useState(false)
  const nedryVideoRef = useRef<HTMLVideoElement>(null)
  const nedryAudioRef = useRef<HTMLAudioElement>(null)

  const isLockedOut = cooldownRemaining > 0
  const showLockoutOverlay = strikes >= 3 && cooldownRemaining > 0

  const primeNedryMedia = useCallback(
    (media: HTMLMediaElement | null) => {
      if (!media) return
      media.muted = true
      void media.play().then(() => {
        media.pause()
        media.currentTime = 0
        media.muted = false
      })
    },
    []
  )

  /** Prime playback during the submit click so lockout audio can start after async auth. */
  const primeNedryPlayback = useCallback(() => {
    if (useGifFallback) {
      primeNedryMedia(nedryAudioRef.current)
      return
    }
    primeNedryMedia(nedryVideoRef.current)
  }, [primeNedryMedia, useGifFallback])

  const playNedryLockout = useCallback(() => {
    const media = useGifFallback ? nedryAudioRef.current : nedryVideoRef.current
    if (!media) return

    media.currentTime = 0
    media.muted = false
    media.loop = true

    const attempt = () => {
      void media.play().catch(() => {
        media.muted = true
        void media.play()
      })
    }

    if (media.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      attempt()
      return
    }

    media.addEventListener('canplay', attempt, { once: true })
    media.load()
  }, [useGifFallback])

  useEffect(() => {
    setMounted(true)

    const stored = readNedryLockoutState()
    if (!stored) return

    const remaining = remainingLockoutSeconds(stored.expiresAt)
    if (remaining > 0) {
      setStrikes(stored.strikes)
      setCooldownRemaining(remaining)
      return
    }

    clearNedryLockoutState()
  }, [])

  useEffect(() => {
    if (!authError) return

    if (authError === 'dev_mock_sign_in_failed') {
      setError(
        authErrorDetail
          ? `Dev mock sign-in failed: ${authErrorDetail}`
          : 'Dev mock sign-in failed. Check DEV_MOCK_* credentials in .env.local.'
      )
      return
    }
    if (authError.startsWith('dev_mock_missing_credentials_')) {
      const role = authError.replace('dev_mock_missing_credentials_', '')
      const envPrefix =
        role === 'coordinator'
          ? 'DEV_MOCK_COORDINATOR'
          : role === 'vendor'
            ? 'DEV_MOCK_VENDOR'
            : 'DEV_MOCK_SHOPPER'
      setError(`Set ${envPrefix}_EMAIL and ${envPrefix}_PASSWORD in .env.local.`)
      return
    }
    if (authError === 'invalid_mock_role') {
      setError('Invalid mock_role. Use coordinator, vendor, or shopper.')
      return
    }
    if (authError === 'auth_callback_failed') {
      const pkceHint =
        authErrorDetail?.toLowerCase().includes('pkce') ||
        authErrorDetail?.toLowerCase().includes('code verifier')
          ? ' If you opened the sign-in link in a different browser or cleared cookies, try again in the same window.'
          : ''
      setError(
        authErrorDetail
          ? `Sign-in could not be completed: ${authErrorDetail}${pkceHint}`
          : `Sign-in could not be completed. Please try again.${pkceHint}`
      )
      return
    }
    if (authError === 'auth_callback_missing_code') {
      setError('Sign-in link was incomplete. Please try again.')
      return
    }
    if (authError === 'oauth_cancelled') {
      setError('Sign-in was cancelled.')
      return
    }
    if (authError === 'oauth_failed') {
      setError(
        authErrorDetail
          ? `Sign-in failed: ${authErrorDetail}`
          : 'Sign-in failed. Please try again or use email sign-in.'
      )
      return
    }
    setError(authError)
  }, [authError, authErrorDetail])

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete('redirectTo')
    window.location.replace(`/api/auth/callback?${params.toString()}`)
  }, [searchParams])

  useEffect(() => {
    if (cooldownRemaining <= 0) return

    const timer = window.setInterval(() => {
      setCooldownRemaining((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [cooldownRemaining])

  const registerFailedAttempt = useCallback(() => {
    setStrikes((prev) => {
      const nextStrikes = prev + 1
      const lockoutSeconds = lockoutSecondsForStrike(nextStrikes)
      if (lockoutSeconds > 0) {
        const expiresAt = Date.now() + lockoutSeconds * 1000
        writeNedryLockoutState({ strikes: nextStrikes, expiresAt })
        setCooldownRemaining(lockoutSeconds)
        setPasswordVisible(false)
      }
      return nextStrikes
    })
  }, [])

  useEffect(() => {
    if (!showLockoutOverlay) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showLockoutOverlay])

  useEffect(() => {
    if (!showLockoutOverlay) return
    playNedryLockout()
  }, [showLockoutOverlay, playNedryLockout])

  useEffect(() => {
    if (cooldownRemaining > 0 || strikes < 3) return
    clearNedryLockoutState()
  }, [cooldownRemaining, strikes])

  useEffect(() => {
    if (!showLockoutOverlay) return

    const trapHistory = () => {
      window.history.pushState({ nedryLockout: true }, '', window.location.href)
    }

    trapHistory()

    const onPopState = () => {
      trapHistory()
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('popstate', onPopState)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [showLockoutOverlay])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (isLockedOut) return

    primeNedryPlayback()

    setLoading(true)
    setError(null)

    const trimmedEmail = normalizeLoginCredential(email)
    const trimmedPassword = normalizeLoginCredential(password)
    const validationError = validateLoginCredentials(trimmedEmail, trimmedPassword)

    if (validationError) {
      setError(validationError)
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password: trimmedPassword,
    })

    if (signInError) {
      if (isEmailNotConfirmedAuthError(signInError.message)) {
        const confirmUrl = new URL('/confirm-email', window.location.origin)
        confirmUrl.searchParams.set('email', trimmedEmail)
        if (redirectTo) confirmUrl.searchParams.set('redirectTo', redirectTo)
        router.push(`${confirmUrl.pathname}${confirmUrl.search}`)
        setLoading(false)
        return
      }
      setError(signInError.message)
      registerFailedAttempt()
      setLoading(false)
      return
    }

    setStrikes(0)
    setCooldownRemaining(0)
    clearNedryLockoutState()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const dashboard = resolvePostLoginPath({
        role: profile?.role,
        redirectTo,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })

      router.push(dashboard)
    }
  }

  useEffect(() => {
    onNativeOAuthBrowserFinished((reason) => {
      setOauthPendingProvider(null)
      if (reason === 'cancelled') {
        setError('Sign-in was cancelled.')
      }
    })
    return () => {
      onNativeOAuthBrowserFinished(null)
    }
  }, [])

  async function handleOAuthSignIn(provider: OAuthProviderId) {
    if (isLockedOut || oauthPendingProvider) return
    setError(null)
    setOauthPendingProvider(provider)

    const result = await signInWithOAuth(supabase, provider, { next: redirectTo })

    if (result.mode === 'error') {
      setOauthPendingProvider(null)
      setError(result.message)
      return
    }

    if (result.mode === 'redirect') {
      setOauthPendingProvider(null)
    }
  }

  const formBody = (
    <>
      {!embedded ? (
        <div className="text-center">
          <img
            src="/popup-hub-brand.png"
            alt="Popup Hub"
            className="w-44 h-auto object-contain mx-auto mb-4"
          />
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">
            Welcome to Popup Hub
          </h1>
        </div>
      ) : null}

      <div>
        <Card className={embedded ? 'border-0 shadow-none' : 'relative z-[1] marketing-glass-card shadow-[var(--shadow-market-md)]'}>
          {!embedded ? (
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Sign in</CardTitle>
              <CardDescription>Enter your credentials to continue</CardDescription>
            </CardHeader>
          ) : null}
          <CardContent className={embedded ? 'px-0 pt-0 space-y-4' : 'space-y-4'}>
            <OAuthProviderButtons
              pendingProvider={oauthPendingProvider}
              disabled={isLockedOut || loading}
              onSignIn={(provider) => void handleOAuthSignIn(provider)}
            />

            <div className="relative flex items-center">
              <Separator className="flex-1" />
              <span className="mx-3 text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email-qa">Email</Label>
                <Input
                  id="email-qa"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLockedOut || loading}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={passwordInputId}>Password</Label>
                <div className="relative">
                  <Input
                    id={passwordInputId}
                    type={passwordVisible ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLockedOut || loading}
                    autoComplete="current-password"
                    className="pr-10"
                    aria-describedby={passwordToggleId}
                  />
                  <Button
                    id={passwordToggleId}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full min-h-11 w-10 touch-manipulation"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    disabled={isLockedOut || loading}
                    aria-label={passwordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={passwordVisible}
                  >
                    {passwordVisible ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </Button>
                </div>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              {strikes > 0 && strikes < 3 ? (
                <p className="text-xs text-amber-700">
                  Failed attempts: {strikes}/3 before system lockout.
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full min-h-11 touch-manipulation"
                disabled={loading || isLockedOut}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
              </Button>
            </form>
          </CardContent>
          {!embedded ? (
            <CardFooter className="flex justify-center border-t pt-4">
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-semibold text-forest hover:underline">
                  Sign up free
                </Link>
              </p>
            </CardFooter>
          ) : null}
        </Card>
      </div>
    </>
  )

  const nedryMedia = useGifFallback ? (
    <>
      <img
        src={MAGIC_WORD_GIF}
        alt="Dennis Nedry security denial animation"
        className="w-full h-auto border-4 border-red-600 rounded shadow-2xl"
      />
      <audio
        ref={nedryAudioRef}
        src={MAGIC_WORD_VIDEO}
        preload="auto"
        loop
        className="sr-only"
        aria-hidden
      />
    </>
  ) : (
    <video
      ref={nedryVideoRef}
      src={MAGIC_WORD_VIDEO}
      autoPlay={showLockoutOverlay}
      loop
      playsInline
      preload="auto"
      muted={!showLockoutOverlay}
      className="w-full h-auto border-4 border-red-600 rounded shadow-2xl"
      onError={() => setUseGifFallback(true)}
    />
  )

  const nedryPortal =
    mounted &&
    createPortal(
      <div
        className={
          showLockoutOverlay
            ? 'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black p-6 font-mono select-none'
            : 'sr-only'
        }
        role={showLockoutOverlay ? 'alertdialog' : undefined}
        aria-modal={showLockoutOverlay ? true : undefined}
        aria-labelledby={showLockoutOverlay ? 'nedry-lockout-title' : undefined}
        aria-describedby={showLockoutOverlay ? 'nedry-lockout-countdown' : undefined}
        aria-hidden={showLockoutOverlay ? undefined : true}
        tabIndex={showLockoutOverlay ? -1 : undefined}
        onKeyDown={
          showLockoutOverlay
            ? (event) => {
                event.preventDefault()
                event.stopPropagation()
              }
            : undefined
        }
      >
        <div
          className={
            showLockoutOverlay
              ? 'max-w-sm rounded-md border-4 border-red-600 bg-zinc-950 p-6 text-center shadow-[0_0_30px_rgba(220,38,38,0.5)]'
              : undefined
          }
        >
          {showLockoutOverlay ? (
            <h1
              id="nedry-lockout-title"
              className="mb-4 animate-pulse text-xl font-black tracking-widest text-red-500"
            >
              ⚠️ SECURITY ALERT ⚠️
            </h1>
          ) : null}

          {nedryMedia}

          {showLockoutOverlay ? (
            <>
              <p className="mb-4 text-sm font-bold uppercase tracking-wide text-red-500">
                &quot;YOU DIDN&apos;T SAY THE MAGIC WORD!&quot;
              </p>

              <div
                id="nedry-lockout-countdown"
                className="rounded border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-400"
              >
                ACCESS DENIED. LOCKOUT EXPIRY:{' '}
                <span className="text-sm font-bold text-white tabular-nums">
                  {formatLockoutCountdown(cooldownRemaining)}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </div>,
      document.body
    )

  if (showLockoutOverlay) {
    return <>{nedryPortal}</>
  }

  if (embedded) {
    return (
      <>
        {nedryPortal}
        {formBody}
      </>
    )
  }

  return (
    <>
      {nedryPortal}
      <div className="w-full max-w-md space-y-6">{formBody}</div>
    </>
  )
}

export default LoginQa
