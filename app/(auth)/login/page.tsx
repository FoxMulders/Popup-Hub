export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import LoginForm from './login-form'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <Suspense fallback={<div className="w-full max-w-md h-96 animate-pulse bg-white rounded-2xl" />}>
        <LoginForm />
      </Suspense>
    </div>
  )
}
