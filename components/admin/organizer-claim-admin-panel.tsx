'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type ClaimRow = {
  id: string
  status: string
  verification_note: string | null
  created_at: string
  matchScore?: number
  matchSignals?: { label: string; matched: boolean }[]
  organizer: { slug: string; display_name: string; city: string } | null
  requester: { full_name: string | null; email: string | null } | null
}

export function OrganizerClaimAdminPanel() {
  const [rows, setRows] = useState<ClaimRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/organizer-claims')
    setLoading(false)
    if (!res.ok) {
      toast.error('Could not load claim requests')
      return
    }
    const json = (await res.json()) as { requests?: ClaimRow[] }
    setRows(json.requests ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(id: string, action: 'approve' | 'reject') {
    setActingId(id)
    const res = await fetch(`/api/admin/organizer-claims/${id}/${action}`, { method: 'POST' })
    setActingId(null)
    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      toast.error(json.error ?? 'Action failed')
      return
    }
    toast.success(action === 'approve' ? 'Claim approved' : 'Claim rejected')
    void load()
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading claim requests…
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No pending organizer claim requests.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">
                {row.organizer?.display_name ?? 'Unknown organizer'}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.organizer?.city ?? '—'} · /organizers/{row.organizer?.slug}
              </p>
            </div>
            <Badge variant="outline">Pending</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Requested by{' '}
            <span className="font-medium text-foreground">
              {row.requester?.full_name ?? row.requester?.email ?? 'Coordinator'}
            </span>
            {row.requester?.email ? ` (${row.requester.email})` : null}
          </p>
          {row.verification_note ? (
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
              {row.verification_note}
            </p>
          ) : (
            <p className="text-xs text-red-700">No verification note provided.</p>
          )}
          {row.matchSignals && row.matchSignals.length > 0 ? (
            <ul className="flex flex-wrap gap-2 text-xs">
              {row.matchSignals.map((signal) => (
                <li key={signal.label}>
                  <Badge variant={signal.matched ? 'default' : 'outline'}>
                    {signal.matched ? '✓' : '○'} {signal.label}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={actingId === row.id}
              onClick={() => void act(row.id, 'approve')}
            >
              {actingId === row.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Approve claim
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={actingId === row.id}
              onClick={() => void act(row.id, 'reject')}
            >
              Reject
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
