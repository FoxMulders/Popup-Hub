'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface VenueSubmissionRow {
  id: string
  location_name: string
  address: string
  latitude: number
  longitude: number
  market_city: string | null
  status: string
  created_at: string
  submitter?: { full_name?: string | null; email?: string | null } | null
}

export function AdminVenueSubmissionsPanel() {
  const [rows, setRows] = useState<VenueSubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/venue-submissions')
    const json = (await res.json()) as { submissions?: VenueSubmissionRow[]; error?: string }
    setLoading(false)
    if (!res.ok) {
      toast.error(json.error ?? 'Could not load venue submissions')
      return
    }
    setRows(json.submissions ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function act(submissionId: string, action: 'approve' | 'reject') {
    setActingId(submissionId)
    const res = await fetch('/api/admin/venue-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, action }),
    })
    setActingId(null)
    if (!res.ok) {
      const json = (await res.json()) as { error?: string }
      toast.error(json.error ?? 'Action failed')
      return
    }
    toast.success(action === 'approve' ? 'Venue approved' : 'Venue rejected')
    void refresh()
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading venue submissions…
      </p>
    )
  }

  const pending = rows.filter((row) => row.status === 'pending')

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {pending.length} pending · {rows.length} total submissions. Approving adds a venue to the
        shared coordinator dropdown — it does not gate market creation.
      </p>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-foreground">{row.location_name}</p>
                <p className="text-sm text-muted-foreground">{row.address}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.submitter?.full_name ?? row.submitter?.email ?? 'Coordinator'} ·{' '}
                  {row.status}
                </p>
              </div>
              {row.status === 'pending' ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={actingId === row.id}
                    onClick={() => void act(row.id, 'approve')}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={actingId === row.id}
                    onClick={() => void act(row.id, 'reject')}
                  >
                    Reject
                  </Button>
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
