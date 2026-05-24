'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Loader2, Store } from 'lucide-react'
import { toast } from 'sonner'

export default function VendorActivatePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!token) setError(null)
  }, [token])

  function activateLegacyInvitation() {
    if (!token) return
    startTransition(async () => {
      const res = await fetch('/api/vendor/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = (await res.json()) as { error?: string; redirect?: string }
      if (!res.ok) {
        setError(data.error ?? 'Activation failed')
        toast.error(data.error ?? 'Activation failed')
        return
      }
      toast.success('Vendor portal activated')
      router.push(data.redirect ?? '/vendor/passport')
      router.refresh()
    })
  }

  function enableVendorAccess() {
    startTransition(async () => {
      const res = await fetch('/api/profile/enable-vendor', { method: 'POST' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Could not enable vendor access')
        toast.error(data.error ?? 'Could not enable vendor access')
        return
      }
      toast.success('Vendor access enabled')
      router.push('/vendor/passport')
      router.refresh()
    })
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
          <Store className="mx-auto h-10 w-10 text-forest" />
          <h1 className="mt-4 font-heading text-xl font-semibold">Become a vendor</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vendors can sign up directly — no organizer pre-approval required. Juried markets review
            each booth application when you apply.
          </p>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-6 space-y-2">
            <Link href="/signup?role=vendor">
              <Button className="min-h-11 w-full">Create vendor account</Button>
            </Link>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              disabled={pending}
              onClick={enableVendorAccess}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Enable vendor on current account
            </Button>
          </div>
          <Link href="/discover" className="mt-4 inline-block text-sm text-forest hover:underline">
            Back to markets
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <Store className="mx-auto h-10 w-10 text-forest" />
        <h1 className="mt-4 font-heading text-xl font-semibold">Legacy vendor invitation</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This link is from an older organizer invitation. You can still activate it, or sign up as a
          vendor directly — booth approval only applies on juried markets.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button
          type="button"
          className="mt-6 min-h-11 w-full"
          disabled={pending}
          onClick={activateLegacyInvitation}
        >
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Activate invitation
        </Button>
        <Link href="/signup?role=vendor" className="mt-4 inline-block text-sm text-forest hover:underline">
          Or sign up as a vendor
        </Link>
      </div>
    </div>
  )
}
