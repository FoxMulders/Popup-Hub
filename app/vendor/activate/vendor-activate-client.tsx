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
    if (!token) setError('Missing activation link.')
  }, [token])

  function activate() {
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

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-muted-foreground">This activation link is invalid.</p>
        <Link href="/discover">
          <Button className="mt-4">Back to markets</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <Store className="mx-auto h-10 w-10 text-forest" />
        <h1 className="mt-4 font-heading text-xl font-semibold">Activate vendor portal</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A market organizer approved you to sell at their events. Activate your vendor account to
          build your passport and apply for booths.
        </p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Button type="button" className="mt-6 min-h-11 w-full" disabled={pending} onClick={activate}>
          {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Activate and continue
        </Button>
        <Link href="/discover" className="mt-4 inline-block text-sm text-forest hover:underline">
          Back to markets
        </Link>
      </div>
    </div>
  )
}
