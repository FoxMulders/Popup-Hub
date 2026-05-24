'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { BrandLogoMark } from '@/components/brand/popup-hub-logo'
import { Loader2 } from 'lucide-react'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/discover'
  const authError = searchParams.get('error')
  const authErrorDetail = searchParams.get('detail')
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    if (!authError) return null
    if (authError === 'dev_mock_sign_in_failed') {
      return authErrorDetail
        ? `Dev mock sign-in failed: ${authErrorDetail}`
        : 'Dev mock sign-in failed. Check DEV_MOCK_* credentials in .env.local.'
    }
    if (authError.startsWith('dev_mock_missing_credentials_')) {
      const role = authError.replace('dev_mock_missing_credentials_', '')
      const envPrefix =
        role === 'coordinator'
          ? 'DEV_MOCK_COORDINATOR'
          : role === 'vendor'
            ? 'DEV_MOCK_VENDOR'
            : 'DEV_MOCK_SHOPPER'
      return `Set ${envPrefix}_EMAIL and ${envPrefix}_PASSWORD in .env.local.`
    }
    if (authError === 'invalid_mock_role') {
      return 'Invalid mock_role. Use coordinator, vendor, or shopper.'
    }
    if (authError === 'auth_callback_failed') {
      return authErrorDetail
        ? `Google sign-in could not be completed: ${authErrorDetail}`
        : 'Google sign-in could not be completed. Please try again.'
    }
    if (authError === 'auth_callback_missing_code') {
      return 'Sign-in link was incomplete. Please try again.'
    }
    if (authError === 'oauth_cancelled') {
      return 'Sign-in was cancelled.'
    }
    if (authError === 'oauth_failed') {
      return authErrorDetail
        ? `Google sign-in failed: ${authErrorDetail}`
        : 'Google sign-in failed. Please try again or use email sign-in.'
    }
    return authError
  })

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) return

    const params = new URLSearchParams(searchParams.toString())
    params.delete('redirectTo')
    window.location.replace(`/api/auth/callback?${params.toString()}`)
  }, [searchParams])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const { count } = await supabase
        .from('coordinator_vendor_approvals')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_user_id', user.id)

      const dashboard =
        profile?.role === 'coordinator'
          ? '/coordinator/dashboard'
          : (count ?? 0) > 0 && profile?.role === 'vendor'
            ? '/vendor/dashboard'
            : redirectTo

      router.push(dashboard)
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    const params = new URLSearchParams({ next: redirectTo })
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?${params.toString()}`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })
    if (oauthError) {
      setError(oauthError.message)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <BrandLogoMark size="auth" />
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-muted-foreground mt-1">Sign in to your Popup Hub account</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription>Enter your credentials to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full min-h-11 gap-2 touch-manipulation"
            onClick={handleGoogleSignIn}
            type="button"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          <div className="relative flex items-center">
            <Separator className="flex-1" />
            <span className="mx-3 text-xs text-gray-400">or</span>
            <Separator className="flex-1" />
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full min-h-11 touch-manipulation" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-semibold text-forest hover:underline">
              Sign up free
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
