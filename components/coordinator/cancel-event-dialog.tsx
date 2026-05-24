'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  CANCELLATION_REASONS,
  type EventCancellationReason,
} from '@/lib/coordinator/cancellation-reasons'
import {
  computeNoticeDays,
  isLateCancellation,
  NOTICE_WINDOW_DAYS,
} from '@/lib/coordinator/reliability-penalty'

const CONFIRM_WORD = 'CANCEL'

interface CancelEventDialogProps {
  eventId: string
  eventName: string
  eventStartAt: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CancelEventDialog({
  eventId,
  eventName,
  eventStartAt,
  open,
  onOpenChange,
}: CancelEventDialogProps) {
  const router = useRouter()
  const [confirmText, setConfirmText] = useState('')
  const [reason, setReason] = useState<EventCancellationReason | ''>('')
  const [reasonNotes, setReasonNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const noticeDays = useMemo(
    () => computeNoticeDays(new Date(), new Date(eventStartAt)),
    [eventStartAt]
  )

  const willPenalizeLate = reason !== '' && isLateCancellation(noticeDays, reason as EventCancellationReason)

  const canConfirm =
    confirmText === CONFIRM_WORD &&
    reason !== '' &&
    (reason !== 'other' || reasonNotes.trim().length > 0) &&
    !loading

  function resetForm() {
    setConfirmText('')
    setReason('')
    setReasonNotes('')
  }

  async function handleCancel() {
    if (!canConfirm || !reason) return

    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancellationReason: reason,
          cancellationReasonNotes: reason === 'other' ? reasonNotes.trim() : null,
        }),
      })
      const data = await res.json() as {
        ok?: boolean
        error?: string
        refundsFailed?: number
        refundsSucceeded?: number
        vendorsNotified?: number
        reliabilityPenalty?: number
        isLateCancellation?: boolean
        newReliabilityScore?: number
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to cancel event')
        return
      }

      let msg = `Event cancelled. Reliability rating is now ${data.newReliabilityScore ?? '—'}%.`
      if ((data.reliabilityPenalty ?? 0) > 0) {
        msg += ` (−${data.reliabilityPenalty} pts${data.isLateCancellation ? ', late notice' : ''})`
      }
      if ((data.refundsFailed ?? 0) > 0) {
        toast.warning(
          `${msg} ${data.refundsFailed} refund(s) need manual retry.`
        )
      } else {
        toast.success(msg)
      }

      resetForm()
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error('Network error while cancelling event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!loading) {
          onOpenChange(o)
          if (!o) resetForm()
        }
      }}
    >
      <AlertDialogContent className="max-w-lg border-red-200">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <AlertDialogTitle className="text-red-700">Cancel Event</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4 text-left text-sm text-foreground">
            <div className="space-y-4">
              <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-medium text-red-800">
                Danger: This action is permanent. Canceling this event will immediately initiate
                full refunds for all approved vendors through Square and notify them via email.
              </p>

              {noticeDays < NOTICE_WINDOW_DAYS && (
                <p className="rounded-lg border border-harvest-200 bg-harvest-50 p-3 text-harvest-800 text-xs">
                  <strong>Notice window:</strong> This event starts in{' '}
                  {noticeDays < 1
                    ? 'less than 1 day'
                    : `${Math.floor(noticeDays)} day${Math.floor(noticeDays) === 1 ? '' : 's'}`}
                  . Non-emergency cancellations deduct points from your public Coordinator Reliability
                  Rating and may show a &quot;Recent Late Cancellation&quot; badge on your profile.
                </p>
              )}

              <p>
                You are about to cancel <strong>{eventName}</strong>. All booth applications will
                be closed and vendors will see your stated reason.
              </p>

              <div className="space-y-2">
                <Label htmlFor="cancel-reason" className="text-foreground">
                  Cancellation reason <span className="text-red-600">*</span>
                </Label>
                <Select
                  value={reason}
                  onValueChange={(v) => v !== null && setReason(v as EventCancellationReason)}
                >
                  <SelectTrigger id="cancel-reason" className="border-red-100">
                    <SelectValue placeholder="Select a reason…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CANCELLATION_REASONS.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reason && (
                  <p className="text-xs text-muted-foreground">
                    {CANCELLATION_REASONS.find((r) => r.value === reason)?.description}
                  </p>
                )}
                {willPenalizeLate && (
                  <p className="text-xs font-medium text-red-700">
                    This reason will apply a late-cancellation reliability penalty.
                  </p>
                )}
              </div>

              {reason === 'other' && (
                <div className="space-y-2">
                  <Label htmlFor="cancel-notes" className="text-foreground">
                    Details <span className="text-red-600">*</span>
                  </Label>
                  <Textarea
                    id="cancel-notes"
                    value={reasonNotes}
                    onChange={(e) => setReasonNotes(e.target.value)}
                    placeholder="Explain why this market is being cancelled…"
                    rows={3}
                    disabled={loading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="cancel-confirm" className="text-foreground">
                  Type <span className="font-mono font-bold">{CONFIRM_WORD}</span> to confirm
                </Label>
                <Input
                  id="cancel-confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder={CONFIRM_WORD}
                  autoComplete="off"
                  className="font-mono uppercase border-red-200 focus-visible:ring-red-400"
                  disabled={loading}
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep Event</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={!canConfirm}
            onClick={(e) => {
              e.preventDefault()
              void handleCancel()
            }}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing refunds…
              </>
            ) : (
              'Cancel Event & Refund Vendors'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
