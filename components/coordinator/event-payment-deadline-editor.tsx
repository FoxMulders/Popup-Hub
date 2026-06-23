'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Timer } from 'lucide-react'
import {
  PAYMENT_CUTOFF_DAYS_BEFORE_EVENT,
  PAYMENT_DUE_HOURS_AFTER_APPROVAL,
  formatPaymentDueAtDisplay,
} from '@/lib/applications/payment-deadline'
import type { Event } from '@/types/database'

interface EventPaymentDeadlineEditorProps {
  event: Event
  disabled?: boolean
}

function toLocalInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60 * 1000)
  return local.toISOString().slice(0, 16)
}

export function EventPaymentDeadlineEditor({
  event,
  disabled = false,
}: EventPaymentDeadlineEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [value, setValue] = useState(toLocalInputValue(event.payment_due_at))
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  async function save() {
    setSaving(true)
    try {
      const paymentDueAt = value.trim()
        ? new Date(value).toISOString()
        : null

      const { error } = await supabase
        .from('events')
        .update({ payment_due_at: paymentDueAt })
        .eq('id', event.id)

      if (error) throw error
      startTransition(() => router.refresh())
    } catch {
      // optional toast
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-stone-200/80 bg-canvas/40 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-harvest-700" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">Payment deadline override</p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            Optional absolute cutoff for unpaid booths on this market. If unset, vendors must pay
            within {PAYMENT_DUE_HOURS_AFTER_APPROVAL} hours of approval or by{' '}
            {PAYMENT_CUTOFF_DAYS_BEFORE_EVENT} days before the event — whichever is sooner.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`payment-due-${event.id}`} className="text-xs">
            All unpaid applications due by
          </Label>
          <Input
            id={`payment-due-${event.id}`}
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled || saving}
          />
          {event.payment_due_at ? (
            <p className="text-[10px] text-muted-foreground">
              Saved: {formatPaymentDueAtDisplay(event.payment_due_at)}
            </p>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || saving}
          onClick={() => void save()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save deadline'}
        </Button>
      </div>
    </div>
  )
}
