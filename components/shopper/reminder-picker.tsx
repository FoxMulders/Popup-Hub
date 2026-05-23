'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { REMINDER_OPTIONS, computeRemindAt } from '@/lib/shopper/reminders'
import type { ReminderOffset } from '@/types/database'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface ReminderPickerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  eventStartAt: string
  existingOffsets: string[]
}

export function ReminderPicker({
  open,
  onOpenChange,
  eventId,
  eventStartAt,
  existingOffsets,
}: ReminderPickerProps) {
  const router = useRouter()
  const supabase = createClient()
  const [pending, startTransition] = useTransition()

  function schedule(offset: ReminderOffset) {
    if (existingOffsets.includes(offset)) {
      toast.info('Reminder already set')
      return
    }
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const remind_at = computeRemindAt(eventStartAt, offset).toISOString()
      const { error } = await supabase.from('event_reminders').insert({
        user_id: user.id,
        event_id: eventId,
        reminder_offset: offset,
        remind_at,
      })
      if (error) {
        toast.error('Could not set reminder')
        return
      }
      toast.success('Reminder scheduled')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Remind me</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {REMINDER_OPTIONS.map(({ offset, label }) => (
            <Button
              key={offset}
              type="button"
              variant={existingOffsets.includes(offset) ? 'secondary' : 'outline'}
              className="min-h-11 w-full justify-start"
              disabled={pending || existingOffsets.includes(offset)}
              onClick={() => schedule(offset)}
            >
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {label}
              {existingOffsets.includes(offset) ? ' ✓' : ''}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
