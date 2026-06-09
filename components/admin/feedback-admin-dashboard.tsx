'use client'

import { useMemo, useState, useTransition } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FeedbackScreenshotPreview } from '@/components/admin/feedback-screenshot-preview'
import {
  FEATURE_TARGET_COMPONENTS,
  FEATURE_IMPACT_LEVELS,
} from '@/lib/feedback/feature-request-config'
import {
  FEATURE_REQUEST_STATUSES,
  featureRequestStatusLabel,
  impactLevelBadgeVariant,
  impactLevelShortLabel,
  submitterRoleBadgeClass,
  submitterRoleLabel,
} from '@/lib/feedback/feature-request-admin-config'
import { cn } from '@/lib/utils'
import type { FeatureRequest, FeatureRequestStatus } from '@/types/database'

interface FeedbackAdminDashboardProps {
  initialRequests: FeatureRequest[]
}

function targetComponentLabel(request: FeatureRequest): string {
  const options = FEATURE_TARGET_COMPONENTS[request.submitter_role]
  return options.find((option) => option.value === request.target_component)?.label ?? request.target_component
}

function impactLabel(level: FeatureRequest['impact_level']): string {
  return FEATURE_IMPACT_LEVELS.find((option) => option.value === level)?.label ?? level
}

export function FeedbackAdminDashboard({ initialRequests }: FeedbackAdminDashboardProps) {
  const [requests, setRequests] = useState(initialRequests)
  const [selectedId, setSelectedId] = useState<string | null>(initialRequests[0]?.id ?? null)
  const [draftStatus, setDraftStatus] = useState<FeatureRequestStatus | null>(null)
  const [draftNotes, setDraftNotes] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId]
  )

  const metrics = useMemo(
    () => ({
      pending: requests.filter((request) => request.status === 'pending').length,
      critical: requests.filter((request) => request.impact_level === 'critical').length,
      underReview: requests.filter((request) => request.status === 'under_review').length,
    }),
    [requests]
  )

  const activeStatus = draftStatus ?? selected?.status ?? 'pending'
  const activeNotes = draftNotes ?? selected?.developer_notes ?? ''

  const isDirty =
    selected != null &&
    (activeStatus !== selected.status || activeNotes !== (selected.developer_notes ?? ''))

  function selectRequest(id: string) {
    setSelectedId(id)
    setDraftStatus(null)
    setDraftNotes(null)
  }

  function saveChanges() {
    if (!selected || !isDirty) return

    startTransition(async () => {
      try {
        const res = await fetch('/api/feedback/update', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: selected.id,
            status: activeStatus,
            developer_notes: activeNotes,
          }),
        })

        const data = (await res.json()) as { error?: string; request?: FeatureRequest }
        if (!res.ok) {
          toast.error(data.error ?? 'Could not save changes')
          return
        }

        if (data.request) {
          setRequests((list) =>
            list.map((item) => (item.id === data.request!.id ? data.request! : item))
          )
          setDraftStatus(null)
          setDraftNotes(null)
        }

        toast.success('Changes saved')
      } catch {
        toast.error('Network error — please try again')
      }
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="market-panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="market-panel-title">Feature requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Triage platform-wide suggestions from coordinators, vendors, and patrons.
            </p>
          </div>
          <p className="text-xs text-muted-foreground tabular-nums">{requests.length} total</p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MetricCard label="Total Pending" value={metrics.pending} tone="neutral" />
          <MetricCard label="Critical Urgency" value={metrics.critical} tone="critical" />
          <MetricCard label="Under Review" value={metrics.underReview} tone="review" />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
        <section
          className="market-panel flex min-h-[420px] flex-col overflow-hidden lg:min-h-0"
          aria-label="Feature request list"
        >
          <div className="market-panel-header border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">Incoming requests</h3>
            <p className="text-xs text-muted-foreground">Newest first</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {requests.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No feature requests yet.</p>
            ) : (
              <ul className="space-y-2">
                {requests.map((request) => {
                  const isSelected = request.id === selectedId
                  return (
                    <li key={request.id}>
                      <button
                        type="button"
                        onClick={() => selectRequest(request.id)}
                        className={cn(
                          'w-full rounded-xl border p-3 text-left transition-colors',
                          isSelected
                            ? 'border-forest bg-forest/5 ring-1 ring-forest/30'
                            : 'border-border bg-card hover:border-border hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-2 text-sm font-semibold leading-snug">
                            {request.title}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                            {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                              submitterRoleBadgeClass(request.submitter_role)
                            )}
                          >
                            {submitterRoleLabel(request.submitter_role)}
                          </span>
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
            )}
          </div>
        </section>

        <section
          className="market-panel flex min-h-[420px] flex-col overflow-hidden lg:min-h-0"
          aria-label="Feature request detail"
        >
          {selected ? (
            <>
              <div className="market-panel-header border-b border-border px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <h3 className="text-base font-semibold leading-snug">{selected.title}</h3>
                    <p className="text-xs text-muted-foreground">
                      {targetComponentLabel(selected)}
                      {selected.page_path ? ` · ${selected.page_path}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        submitterRoleBadgeClass(selected.submitter_role)
                      )}
                    >
                      {submitterRoleLabel(selected.submitter_role)}
                    </span>
                    <Badge variant={impactLevelBadgeVariant(selected.impact_level)}>
                      {impactLabel(selected.impact_level)}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Problem statement
                  </h4>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.problem}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                    Proposed solution
                  </h4>
                  <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.dream_solution?.trim() || (
                      <span className="text-muted-foreground italic">No proposed solution provided.</span>
                    )}
                  </div>
                </div>

                {selected.screenshot_url ? (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Screenshot
                    </h4>
                    <FeedbackScreenshotPreview url={selected.screenshot_url} title={selected.title} />
                  </div>
                ) : null}

                <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="feedback-status">Status</Label>
                    <Select
                      value={activeStatus}
                      onValueChange={(value) => {
                        if (value) setDraftStatus(value as FeatureRequestStatus)
                      }}
                      disabled={pending}
                    >
                      <SelectTrigger id="feedback-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FEATURE_REQUEST_STATUSES.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="developer-notes">Developer internal notes</Label>
                    <Textarea
                      id="developer-notes"
                      value={activeNotes}
                      onChange={(event) => setDraftNotes(event.target.value)}
                      rows={4}
                      placeholder="Implementation notes visible only to the platform team…"
                      disabled={pending}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border p-4">
                <Button
                  type="button"
                  className="min-h-10 w-full sm:w-auto"
                  disabled={!isDirty || pending}
                  onClick={saveChanges}
                >
                  {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Save changes
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
              Select a request from the list to preview details.
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: 'neutral' | 'critical' | 'review'
}) {
  const toneClass =
    tone === 'critical'
      ? 'border-terracotta-200 bg-terracotta-50 text-terracotta-900 dark:border-terracotta-800 dark:bg-terracotta-950 dark:text-terracotta-200'
      : tone === 'review'
        ? 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200'
        : 'border-border bg-card text-foreground'

  return (
    <div className={cn('rounded-xl border px-4 py-3', toneClass)}>
      <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}
