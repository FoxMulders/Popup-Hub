'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import { Star } from 'lucide-react'
import type { VendorLineupEntry } from '@/lib/shopper/vendors'

interface VendorReviewsPanelProps {
  eventId: string
  userId: string | null
  vendors: VendorLineupEntry[]
}

export function VendorReviewsPanel({ eventId, userId, vendors }: VendorReviewsPanelProps) {
  const router = useRouter()
  const supabase = createClient()
  const [activeVendorId, setActiveVendorId] = useState<string | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [pending, startTransition] = useTransition()

  if (!userId || vendors.length === 0) return null

  function submit(vendorId: string) {
    if (rating < 1) {
      toast.error('Select a star rating')
      return
    }
    startTransition(async () => {
      const { error } = await supabase.from('vendor_reviews').insert({
        vendor_id: vendorId,
        user_id: userId,
        event_id: eventId,
        rating,
        comment: comment.trim() || null,
      })
      if (error) {
        toast.error('Could not save review')
        return
      }
      toast.success('Thanks for reviewing this vendor!')
      setActiveVendorId(null)
      setRating(0)
      setComment('')
      router.refresh()
    })
  }

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-heading text-lg font-semibold">Rate vendors</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Share feedback on vendors you visited at this market.
      </p>
      <ul className="mt-4 space-y-2">
        {vendors.map((vendor) => {
          if (!vendor.vendor_id) return null
          const open = activeVendorId === vendor.vendor_id
          return (
            <li key={vendor.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{vendor.displayName}</span>
                <Button
                  type="button"
                  size="sm"
                  variant={open ? 'secondary' : 'outline'}
                  onClick={() => {
                    setActiveVendorId(open ? null : vendor.vendor_id!)
                    setRating(0)
                    setComment('')
                  }}
                >
                  {open ? 'Cancel' : 'Review'}
                </Button>
              </div>
              {open && (
                <div className="mt-3 space-y-3 border-t pt-3">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        className="p-1"
                        onClick={() => setRating(n)}
                        aria-label={`${n} stars`}
                      >
                        <Star
                          className={`h-6 w-6 ${n <= rating ? 'fill-harvest-500 text-harvest-500' : 'text-stone-300'}`}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    className="min-h-16"
                    placeholder="Optional comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={() => submit(vendor.vendor_id!)}
                  >
                    Submit vendor review
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
