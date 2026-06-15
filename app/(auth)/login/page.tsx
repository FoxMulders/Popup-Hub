export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import LoginForm from './login-form'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'

export const metadata = buildPublicMetadata({
  title: 'Sign In — Popup Hub',
  description: 'Sign in to Popup Hub to discover markets, manage vendor applications, or run your event.',
  path: '/login',
  noIndex: true,
})

export default function LoginPage() {
  return (
    <div className="relative flex min-h-0 flex-1 items-center justify-center bg-gradient-to-br from-linen via-canvas to-harvest-50 p-4 py-10">
      <Suspense fallback={<div className="w-full max-w-md h-96 animate-pulse market-panel rounded-2xl" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
