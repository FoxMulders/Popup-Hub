'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { CheckCircle2, Inbox, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import { WIZARD_SECTION_LABEL } from '@/lib/wizard/wizard-panel-styles'
import type { MarketFeedback } from '@/types/database'

type FeedbackRow = MarketFeedback & {
  reporter?: { full_name: string; email: string; role: string } | null
}

interface MarketFeedbackAdminPanelProps {
  marketId: string
  refreshToken?: number
}

function contextSummary(row: FeedbackRow): string {
  if (row.context_type === 'layout_conflict') {
    return row.context_id ? `Layout · room ${row.context_id.slice(0, 8)}` : 'Layout conflict'
  }
  if (row.context_type) return row.context_type.replace(/_/g, ' ')
  return 'General'
}

export function MarketFeedbackAdminPanel({ marketId, refreshToken = 0 }: MarketFeedbackAdminPanelProps) {
  const [items, setItems] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [addressingId, setAddressingId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const loadFeedback = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/feedback?market_id=${encodeURIComponent(marketId)}`)
    if (!res.ok) {
      setLoading(false)
      toast.error('Could not load feedback queue')
      return
    }
    const data = (await res.json()) as { feedback?: FeedbackRow[] }
    setItems(data.feedback ?? [])
    setLoading(false)
  }, [marketId])

  useEffect(() => {
    void loadFeedback()
  }, [loadFeedback, refreshToken])

  function markAddressed(id: string) {
    setAddressingId(id)
    setItems((list) => list.filter((item) => item.id !== id))

    startTransition(async () => {
      const res = await fetch(`/api/feedback/${id}/address`, { method: 'PATCH' })
      const data = (await res.json()) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not mark as addressed')
        void loadFeedback()
        setAddressingId(null)
        return
      }

      toast.success('Marked as addressed — reporter notified')
      setAddressingId(null)
    })
  }

  return (
    <section className="market-panel p-3" aria-label="Feedback review">
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-stone-200/80 pb-1.5">
        <h3 className={WIZARD_SECTION_LABEL}>Feedback queue</h3>
        <TooltipWrapper text="Refresh unresolved feedback">
          <button
            type="button"
            onClick={() => void loadFeedback()}
            className="inline-flex min-h-8 items-center gap-1 rounded-none border-2 border-black bg-white px-2 text-[10px] font-black uppercase tracking-wide hover:bg-zinc-100"
            aria-label="Refresh feedback"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </TooltipWrapper>
      </div>

      {loading && items.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden />
          No open feedback
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const reporter = Array.isArray(item.reporter) ? item.reporter[0] : item.reporter
            const isAddressing = addressingId === item.id && pending
            return (
              <li
                key={item.id}
                className="rounded-lg border border-stone-200/80 bg-stone-50/50 p-2 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <p className="text-xs font-semibold leading-snug">
                    {reporter?.full_name ?? 'Unknown'}
                  </p>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {reporter?.role ?? 'user'} · {contextSummary(item)}
                </p>
                <p className="text-xs leading-relaxed text-foreground">{item.comment_text}</p>
                <TooltipWrapper text="Mark resolved and notify the reporting user">
                  <button
                    type="button"
                    disabled={isAddressing}
                    onClick={() => markAddressed(item.id)}
                    className="inline-flex min-h-8 w-full items-center justify-center gap-1 rounded-none border-2 border-black bg-white px-2 text-[10px] font-black uppercase tracking-wide hover:bg-zinc-100 disabled:opacity-50"
                  >
                    {isAddressing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Mark as Addressed
                  </button>
                </TooltipWrapper>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
