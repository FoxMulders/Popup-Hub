'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/lib/toast'
import { Loader2 } from 'lucide-react'
import type { VendorAccessRequest } from '@/types/database'

interface VendorAccessRequestsPanelProps {
  requests: (VendorAccessRequest & {
    shopper?: { full_name: string; email: string } | null
  })[]
}

export function VendorAccessRequestsPanel({ requests: initial }: VendorAccessRequestsPanelProps) {
  const router = useRouter()
  const [requests, setRequests] = useState(initial)
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [pending, startTransition] = useTransition()

  function review(requestId: string, action: 'approve' | 'reject') {
    startTransition(async () => {
      const res = await fetch(`/api/coordinator/vendor-access/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejection_reason: action === 'reject' ? rejectReason.trim() || null : null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Action failed')
        return
      }
      toast.success(action === 'approve' ? 'Vendor approved and notified' : 'Request declined')
      setRequests((list) => list.filter((r) => r.id !== requestId))
      setRejectId(null)
      setRejectReason('')
      router.refresh()
    })
  }

  const pendingRequests = requests.filter((r) => r.status === 'pending')

  if (pendingRequests.length === 0) {
    return null
  }

  return (
    <div className="market-panel space-y-4 p-5">
      <div>
        <h3 className="font-heading font-semibold">Patron vendor-access requests</h3>
        <p className="text-sm text-muted-foreground">
          Patrons asking to become vendors under your organizer profile — not booth applications for a
          specific market. Booth applications appear in the section above.
        </p>
      </div>
      <ul className="space-y-3">
        {pendingRequests.map((request) => {
          const shopper = Array.isArray(request.shopper) ? request.shopper[0] : request.shopper
          return (
            <li key={request.id} className="rounded-xl border bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{shopper?.full_name ?? 'Unknown shopper'}</p>
                  <p className="text-xs text-muted-foreground">{shopper?.email}</p>
                  {request.message && (
                    <p className="mt-2 text-sm text-muted-foreground">{request.message}</p>
                  )}
                </div>
                <Badge variant="outline">Pending</Badge>
              </div>

              {rejectId === request.id ? (
                <div className="mt-3 space-y-2 border-t pt-3">
                  <Textarea
                    placeholder="Optional reason for declining"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectId(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={pending}
                      onClick={() => review(request.id, 'reject')}
                    >
                      Confirm decline
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => review(request.id, 'approve')}
                  >
                    {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setRejectId(request.id)}
                  >
                    Decline
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
