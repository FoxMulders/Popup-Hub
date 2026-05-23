'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Star } from 'lucide-react'

interface ReviewSectionProps {
  eventId: string
  userId: string | null
  existingRating: number | null
}

export function ReviewSection({ eventId, userId, existingRating }: ReviewSectionProps) {
  const router = useRouter()
  const supabase = createClient()
  const [rating, setRating] = useState(existingRating ?? 0)
  const [comment, setComment] = useState('')
  const [pending, startTransition] = useTransition()

  if (!userId) return null

  function submit() {
    if (rating < 1) {
      toast.error('Select a star rating')
      return
    }
    startTransition(async () => {
      const { error } = await supabase.from('event_reviews').upsert(
        {
          event_id: eventId,
          user_id: userId,
          rating,
          comment: comment.trim() || null,
        },
        { onConflict: 'event_id,user_id' }
      )
      if (error) {
        toast.error('Could not save review')
        return
      }
      toast.success('Thanks for your feedback!')
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-heading text-lg font-semibold">Rate this market</h2>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="p-1"
            onClick={() => setRating(n)}
            aria-label={`${n} stars`}
          >
            <Star
              className={`h-7 w-7 ${n <= rating ? 'fill-harvest-500 text-harvest-500' : 'text-stone-300'}`}
            />
          </button>
        ))}
      </div>
      <Textarea
        className="mt-3 min-h-20"
        placeholder="Share your experience (optional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="button" className="mt-3 min-h-11" disabled={pending} onClick={submit}>
        Submit review
      </Button>
    </section>
  )
}
