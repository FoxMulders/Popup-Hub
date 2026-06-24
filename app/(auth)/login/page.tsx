export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { GuestNav } from '@/components/nav/guest-nav'
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
    <div className="flex min-h-0 flex-1 flex-col site-surface">
      <div className="hidden md:block">
        <GuestNav />
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-linen via-canvas to-sage-50 safe-top px-4 pb-10 pt-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
          <div className="absolute -left-20 top-10 h-64 w-64 rounded-full bg-sage-200/50 blur-3xl" />
          <div className="absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-harvest-100/60 blur-3xl" />
        </div>
        <Suspense fallback={<div className="relative z-[1] w-full max-w-md h-96 animate-pulse marketing-glass-card rounded-2xl" />}>
          <div className="relative z-[1] w-full max-w-md">
            <LoginForm />
          </div>
        </Suspense>
      </div>
    </div>
  )
}
