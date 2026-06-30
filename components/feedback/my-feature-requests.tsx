'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { Loader2, RotateCcw } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { toast } from '@/lib/toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FeedbackScreenshotPreview } from '@/components/admin/feedback-screenshot-preview'
import {
  FEATURE_TARGET_COMPONENTS,
} from '@/lib/feedback/feature-request-config'
import {
  featureRequestStatusLabel,
  impactLevelBadgeVariant,
  impactLevelShortLabel,
} from '@/lib/feedback/feature-request-admin-config'
import { cn } from '@/lib/utils'
import type { UserFeatureRequest } from '@/types/database'

interface MyFeatureRequestsProps {
  initialRequests: UserFeatureRequest[]
}

function targetComponentLabel(request: UserFeatureRequest): string {
  const options = FEATURE_TARGET_COMPONENTS[request.submitter_role]
  return options.find((option) => option.value === request.target_component)?.label ?? request.target_component
}

export function MyFeatureRequests({ initialRequests }: MyFeatureRequestsProps) {
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const [requests, setRequests] = useState(initialRequests)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (highlightId && initialRequests.some((r) => r.id === highlightId)) return highlightId
    return initialRequests[0]?.id ?? null
  })
  const [reopenReason, setReopenReason] = useState('')
  const [pending, startTransition] = useTransition()

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  )

  useEffect(() => {
    if (highlightId && requests.some((r) => r.id === highlightId)) {
      setSelectedId(highlightId)
    }
  }, [highlightId, requests])

  function reopenRequest() {
    if (!selected || selected.status !== 'completed') return

    startTransition(async () => {
      try {
        const res = await fetch(`/api/feedback/${selected.id}/reopen`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reopenReason.trim() || undefined }),
        })

        const data = (await res.json()) as { error?: string; request?: UserFeatureRequest }
        if (!res.ok) {
          toast.error(data.error ?? 'Could not reopen this request')
          return
        }

        if (data.request) {
          setRequests((list) =>
            list.map((item) => (item.id === data.request!.id ? data.request! : item))
          )
          setReopenReason('')
        }

        toast.success('Request reopened — our team will take another look')
      } catch {
        toast.error('Network error — please try again')
      }
    })
  }

  if (requests.length === 0) {
    return (
      <div className="market-panel p-8 text-center">
        <p className="text-sm text-muted-foreground">
          You haven&apos;t submitted any feature suggestions yet. Use &ldquo;Suggest an Improvement&rdquo; from
          the menu to share an idea.
        </p>
      </div>
    )
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
      <section
        className="market-panel flex min-h-[420px] flex-col overflow-hidden"
        aria-label="Your suggestions list"
      >
        <div className="market-panel-header border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Your suggestions</h2>
          <p className="text-xs text-muted-foreground">{requests.length} total</p>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {requests.map((request) => {
            const isSelected = request.id === selectedId
            const isHighlighted = request.id === highlightId
            return (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(request.id)}
                  className={cn(
                    'w-full rounded-xl border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-forest bg-forest/5 ring-1 ring-forest/30'
                      : 'border-border bg-card hover:bg-muted/50',
                    isHighlighted && !isSelected && 'border-amber-300 bg-amber-50/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold leading-snug">{request.title}</p>
                    <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant={impactLevelBadgeVariant(request.impact_level)}>
                      {impactLevelShortLabel(request.impact_level)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {featureRequestStatusLabel(request.status)}
                    </Badge>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section
        className="market-panel flex min-h-[420px] flex-col overflow-hidden"
        aria-label="Suggestion detail"
      >
        {selected ? (
          <>
            <div className="market-panel-header border-b border-border px-4 py-3">
              <h3 className="text-base font-semibold leading-snug">{selected.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {targetComponentLabel(selected)}
                {selected.page_path ? ` · ${selected.page_path}` : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant="outline">{featureRequestStatusLabel(selected.status)}</Badge>
                <span className="text-xs text-muted-foreground">
                  Submitted {format(new Date(selected.created_at), 'MMM d, yyyy')}
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              {selected.status === 'completed' || selected.status === 'declined' ? (
                <div className="space-y-2 rounded-xl border border-sage-200 bg-sage-50/80 p-4 dark:border-sage-800 dark:bg-sage-950/40">
                  <h4 className="text-xs font-black uppercase tracking-widest text-sage-800 dark:text-sage-200">
                    {selected.status === 'completed' ? 'What we fixed' : 'Resolution'}
                  </h4>
                  {selected.resolution_notes?.trim() ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{selected.resolution_notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      {selected.status === 'completed'
                        ? 'Marked complete — the team hasn\'t added details yet. You can reopen if this isn\'t resolved.'
                        : 'This request was declined — no additional details were provided.'}
                    </p>
                  )}
                  {selected.resolved_at ? (
                    <p className="text-xs text-muted-foreground">
                      Resolved {format(new Date(selected.resolved_at), 'MMM d, yyyy')}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  Status: {featureRequestStatusLabel(selected.status)}. We&apos;ll notify you when there&apos;s
                  an update.
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Your feedback
                </h4>
                <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.problem}
                </div>
              </div>

              {selected.dream_solution?.trim() ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Proposed solution
                  </h4>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.dream_solution}
                  </div>
                </div>
              ) : null}

              {selected.screenshot_url ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Screenshot
                  </h4>
                  <FeedbackScreenshotPreview url={selected.screenshot_url} title={selected.title} />
                </div>
              ) : null}

              {selected.status === 'completed' ? (
                <div className="space-y-3 border-t border-border pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="reopen-reason">Not resolved? Tell us why (optional)</Label>
                    <Textarea
                      id="reopen-reason"
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                      rows={3}
                      placeholder="What's still missing or broken?"
                      disabled={pending}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10"
                    disabled={pending}
                    onClick={reopenRequest}
                  >
                    {pending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-2 size-4" />
                    )}
                    Reopen this request
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
            Select a suggestion to view details.
          </div>
        )}
      </section>
    </div>
  )
}
