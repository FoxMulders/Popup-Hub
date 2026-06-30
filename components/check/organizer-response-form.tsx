'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  organizerSlug: string
  reviewId?: string
  mentionId?: string
  existingResponse?: string | null
}

export function OrganizerResponseForm({
  organizerSlug,
  reviewId,
  mentionId,
  existingResponse,
}: Props) {
  const [body, setBody] = useState(existingResponse ?? '')
  const [loading, setLoading] = useState(false)

  async function submit() {
    const trimmed = body.trim()
    if (trimmed.length < 10) {
      toast.error('Write at least a short response (10+ characters).')
      return
    }

    setLoading(true)
    try {
      const path = reviewId
        ? `/api/organizers/${organizerSlug}/reviews/${reviewId}/respond`
        : `/api/organizers/${organizerSlug}/mentions/${mentionId}/respond`

      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseBody: trimmed }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not post response')
        return
      }
      toast.success(existingResponse ? 'Response updated' : 'Response posted')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 space-y-2 rounded-md border border-dashed p-3">
      <p className="text-xs font-medium text-foreground">Respond as organizer</p>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Share your side or correct the record…"
      />
      <Button type="button" size="sm" onClick={() => void submit()} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-3 w-3 animate-spin" aria-hidden />
            Saving…
          </>
        ) : existingResponse ? (
          'Update response'
        ) : (
          'Post response'
        )}
      </Button>
    </div>
  )
}
