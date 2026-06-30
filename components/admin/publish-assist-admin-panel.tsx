'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'

type PublishAssistRow = {
  id: string
  status: string
  request_note: string | null
  block_reason: string | null
  created_at: string
  coordinatorName: string
  event: { id: string; name: string; status: string; start_at: string } | null
}

export function PublishAssistAdminPanel() {
  const [rows, setRows] = useState<PublishAssistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/publish-assist')
    setLoading(false)
    if (!res.ok) {
      toast.error('Could not load publish assist requests')
      return
    }
    const json = (await res.json()) as { requests?: PublishAssistRow[] }
    setRows(json.requests ?? [])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(id: string, action: 'approve' | 'reject') {
    setActingId(id)
    const res = await fetch(`/api/admin/publish-assist/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        action === 'reject' ? { reviewNote: 'Unable to publish at this time.' } : {}
      ),
    })
    setActingId(null)
    const json = (await res.json()) as { error?: string }
    if (!res.ok) {
      toast.error(json.error ?? 'Action failed')
      return
    }
    toast.success(action === 'approve' ? 'Market published' : 'Request rejected')
    void load()
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading publish assist requests…
      </p>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        No pending publish assist requests.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.id} className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground">{row.event?.name ?? 'Unknown market'}</p>
              <p className="text-xs text-muted-foreground">
                Organizer: {row.coordinatorName}
                {row.event?.start_at ? ` · ${safeFormatMarketDate(row.event.start_at)}` : ''}
              </p>
            </div>
            <Badge variant="outline">Pending</Badge>
          </div>
          {row.block_reason ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Publish block:</span> {row.block_reason}
            </p>
          ) : null}
          {row.request_note ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Coordinator note:</span> {row.request_note}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {row.event?.id ? (
              <Link
                href={`/coordinator/events/${row.event.id}`}
                className="text-sm font-medium text-forest underline-offset-2 hover:underline"
              >
                Open event hub
              </Link>
            ) : null}
            <Button
              type="button"
              size="sm"
              disabled={actingId === row.id}
              onClick={() => void act(row.id, 'approve')}
            >
              {actingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Publish market'}
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
