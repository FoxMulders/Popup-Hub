'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { MessageSquare } from 'lucide-react'

interface ApplicationFollowUpDialogProps {
  applicationId: string
  eventName: string
  coordinatorName?: string | null
  coordinatorEmail?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSent?: () => void
}

export function ApplicationFollowUpDialog({
  applicationId,
  eventName,
  coordinatorName,
  coordinatorEmail,
  open,
  onOpenChange,
  onSent,
}: ApplicationFollowUpDialogProps) {
  const [message, setMessage] = useState('')
  const [pending, startTransition] = useTransition()

  function sendFollowUp() {
    const trimmed = message.trim()
    if (!trimmed) {
      toast.error('Please enter a message for the organizer')
      return
    }

    startTransition(async () => {
      const res = await fetch(`/api/vendor/applications/${applicationId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not send follow-up')
        return
      }

      toast.success('Follow-up sent — the organizer has been notified')
      setMessage('')
      onOpenChange(false)
      onSent?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-harvest-600" />
            Follow up with organizer
          </DialogTitle>
          <DialogDescription>
            Send a message about your application to{' '}
            {coordinatorName ? <strong>{coordinatorName}</strong> : 'the event organizer'} for{' '}
            <strong>{eventName}</strong>. You can send one follow-up every 24 hours per application.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Example: Checking in on my juried application — happy to share additional product photos if helpful."
          rows={5}
          maxLength={1000}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground text-right">{message.length}/1000</p>

        <DialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">
          <Button onClick={sendFollowUp} disabled={pending || !message.trim()}>
            {pending ? 'Sending…' : 'Send follow-up'}
          </Button>
          {coordinatorEmail ? (
            <a
              href={`mailto:${coordinatorEmail}?subject=${encodeURIComponent(`Application follow-up — ${eventName}`)}`}
              className="inline-flex h-9 w-full items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
            >
              Email organizer directly
            </a>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
