'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Loader2, ShoppingBag, Store, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import type { Role } from '@/types/database'

const ROLES = [
  { id: 'shopper' as Role, label: 'Shopper', desc: 'Find markets & browse vendors', icon: ShoppingBag },
  { id: 'vendor' as Role, label: 'Vendor', desc: 'Sell at local markets', icon: Store },
  { id: 'coordinator' as Role, label: 'Coordinator', desc: 'Organize & manage markets', icon: Calendar },
]

function SignupForm() {
  const router = useRouter()
  const params = useSearchParams()
  const supabase = createClient()

  const defaultRole = (params.get('role') as Role) ?? 'shopper'
  const [role, setRole] = useState<Role>(defaultRole)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    })
    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }
    toast.success('Account created! Redirecting to your dashboard…')
    router.push(`/${role}/dashboard`)
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-10">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500">
            <MapPin className="h-6 w-6 text-white" />
          </div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription>Join the local market ecosystem</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label className="mb-2 block text-sm font-medium">I am a…</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map(({ id, label, desc, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRole(id)}
                  className={`flex flex-col items-center rounded-xl border-2 p-3 text-center transition ${role === id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300'}`}
                >
                  <Icon className={`mb-1 h-5 w-5 ${role === id ? 'text-amber-600' : 'text-gray-400'}`} />
                  <span className="text-xs font-semibold">{label}</span>
                  <span className="hidden text-[10px] text-gray-400 sm:block">{desc}</span>
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={handleSignup} className="space-y-4">
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
            <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Account as <Badge className="ml-1 bg-white/20 text-white capitalize">{role}</Badge>
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-amber-600 hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SignupPage() {
  return <Suspense><SignupForm /></Suspense>
}
