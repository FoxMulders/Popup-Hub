'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  reviewId: string
  eventName: string
  initialResponse?: string | null
}

export function OrganizerReviewRespondForm({
  reviewId,
  eventName,
  initialResponse = null,
}: Props) {
  const router = useRouter()
  const [responseBody, setResponseBody] = useState(initialResponse ?? '')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/organizers/reviews/${reviewId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responseBody }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not save response')
        return
      }
      toast.success(initialResponse ? 'Response updated' : 'Response posted')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-forest/20 bg-sage-50/60 px-3 py-3 space-y-2">
      <Label htmlFor={`respond-${reviewId}`} className="text-xs font-semibold text-foreground">
        Your response — {eventName}
      </Label>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Your reply appears on your trust report under this review. Focus on facts about how the
        market ran — booth placement and neighbour pairings vary and are not always under your
        control.
      </p>
      <Textarea
        id={`respond-${reviewId}`}
        value={responseBody}
        onChange={(e) => setResponseBody(e.target.value)}
        placeholder="Thank the vendor, clarify policies, or share context other vendors should know."
        rows={3}
        required
        minLength={10}
        maxLength={2000}
      />
      <Button type="submit" size="sm" disabled={loading || responseBody.trim().length < 10}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Saving…
          </>
        ) : initialResponse ? (
          'Update response'
        ) : (
          'Post response'
        )}
      </Button>
    </form>
  )
}
