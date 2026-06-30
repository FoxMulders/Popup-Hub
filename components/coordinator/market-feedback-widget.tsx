'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import { Loader2, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MarketFeedbackWidgetProps {
  marketId: string
  /** Compact styling for booth planner sidebar */
  compact?: boolean
  /** Pre-fill when reporting a layout conflict */
  layoutConflict?: {
    roomName?: string
    overlapCount?: number
    contextId?: string
  } | null
  className?: string
  onSubmitted?: () => void
}

export function MarketFeedbackWidget({
  marketId,
  compact = false,
  layoutConflict = null,
  className,
  onSubmitted,
}: MarketFeedbackWidgetProps) {
  const [open, setOpen] = useState(false)
  const [comment, setComment] = useState('')
  const [reportingLayoutConflict, setReportingLayoutConflict] = useState(false)
  const [pending, startTransition] = useTransition()

  const layoutPrefill =
    layoutConflict != null
      ? `Layout conflict report${layoutConflict.roomName ? ` (${layoutConflict.roomName})` : ''}${
          layoutConflict.overlapCount != null
            ? `: ${layoutConflict.overlapCount} overlapping cell${layoutConflict.overlapCount === 1 ? '' : 's'}`
            : ''
        }. `
      : ''

  function openWithLayoutConflict() {
    setComment(layoutPrefill)
    setReportingLayoutConflict(true)
    setOpen(true)
  }

  function submit() {
    const text = comment.trim()
    if (!text) {
      toast.error('Please enter your feedback')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_id: marketId,
          comment_text: text,
          context_type: reportingLayoutConflict ? 'layout_conflict' : null,
          context_id: reportingLayoutConflict ? (layoutConflict?.contextId ?? null) : null,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit feedback')
        return
      }
      toast.success('Feedback submitted — the organizer will review it')
      setComment('')
      setReportingLayoutConflict(false)
      setOpen(false)
      onSubmitted?.()
    })
  }

  return (
    <div
      className={cn('market-panel space-y-2', compact ? 'p-3' : 'p-5', className)}
      aria-label="Submit market feedback"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className={cn('font-heading font-semibold', compact ? 'text-xs' : 'text-sm')}>
            Send feedback
          </h3>
          {!compact ? (
            <p className="text-xs text-muted-foreground">
              Report an issue or share suggestions about this market.
            </p>
          ) : null}
        </div>
        <MessageSquarePlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      {layoutConflict != null && !open ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={openWithLayoutConflict}
        >
          Report layout conflict
        </Button>
      ) : null}

      {!open ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => {
            setReportingLayoutConflict(false)
            setOpen(true)
          }}
        >
          {layoutConflict != null ? 'Other feedback…' : 'Write feedback…'}
        </Button>
      ) : (
        <div className="space-y-2">
          <label htmlFor={`feedback-${marketId}`} className="sr-only">
            Your feedback
          </label>
          <Textarea
            id={`feedback-${marketId}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Describe the issue or suggestion…"
            rows={compact ? 3 : 4}
            className="text-xs"
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1 text-xs"
              disabled={pending}
              onClick={submit}
            >
              {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Submit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={pending}
              onClick={() => {
                setOpen(false)
                setComment('')
                setReportingLayoutConflict(false)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
