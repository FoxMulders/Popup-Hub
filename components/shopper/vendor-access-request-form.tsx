'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Loader2, Store } from 'lucide-react'
import type { VendorAccessRequest } from '@/types/database'
import { accessRequestStatusLabel } from '@/lib/vendor/access'

interface VendorAccessRequestFormProps {
  coordinatorId: string
  coordinatorName: string
  userId: string | null
  existingRequest: VendorAccessRequest | null
}

export function VendorAccessRequestForm({
  coordinatorId,
  coordinatorName,
  userId,
  existingRequest,
}: VendorAccessRequestFormProps) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  if (existingRequest?.status === 'approved') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4">
        <p className="text-sm font-medium text-green-900">
          You&apos;re approved to sell at {coordinatorName}&apos;s markets.
        </p>
        <Button
          type="button"
          className="mt-3 min-h-10"
          onClick={() => router.push('/vendor/dashboard')}
        >
          Open Vendor Portal
        </Button>
      </div>
    )
  }

  if (existingRequest?.status === 'pending') {
    return (
      <div className="rounded-xl border bg-white p-4">
        <Badge variant="outline">{accessRequestStatusLabel('pending')}</Badge>
        <p className="mt-2 text-sm text-muted-foreground">
          Your request to sell at {coordinatorName}&apos;s markets is waiting for review.
        </p>
      </div>
    )
  }

  if (existingRequest?.status === 'rejected') {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <Badge variant="destructive">{accessRequestStatusLabel('rejected')}</Badge>
        {existingRequest.rejection_reason && (
          <p className="mt-2 text-sm text-red-800">{existingRequest.rejection_reason}</p>
        )}
        <p className="mt-2 text-sm text-muted-foreground">
          Contact the organizer if you&apos;d like to discuss reapplying.
        </p>
      </div>
    )
  }

  function submit() {
    if (!userId) {
      router.push(`/login?redirectTo=${encodeURIComponent(window.location.pathname)}`)
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/vendor/access-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinator_id: coordinatorId, message: message.trim() || null }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit request')
        return
      }
      toast.success('Request sent to the organizer')
      router.refresh()
    })
  }

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Store className="h-4 w-4 text-forest" />
        <p className="font-medium text-sm">Request to sell at this organizer&apos;s markets</p>
      </div>
      <p className="text-sm text-muted-foreground">
        {coordinatorName} reviews vendor requests before you can apply for booth space.
      </p>
      <div className="space-y-1">
        <Label htmlFor="vendor-request-message">Introduce your business (optional)</Label>
        <Textarea
          id="vendor-request-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What do you sell? Links to photos or social media…"
          rows={3}
        />
      </div>
      <Button type="button" className="min-h-11 w-full" disabled={pending} onClick={submit}>
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {userId ? 'Send vendor access request' : 'Sign in to request access'}
      </Button>
    </div>
  )
}
