'use client'

import { useState, useTransition } from 'react'
import { LifeBuoy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface RequestPublishAssistButtonProps {
  eventId: string
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
  /** When true, show compact pending state instead of the button. */
  pending?: boolean
  onRequested?: () => void
}

export function RequestPublishAssistButton({
  eventId,
  className,
  variant = 'outline',
  size = 'sm',
  pending = false,
  onRequested,
}: RequestPublishAssistButtonProps) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [isPending, startTransition] = useTransition()

  if (pending) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-harvest-200 bg-harvest-50 px-3 py-1.5 text-xs font-medium text-harvest-900',
          className
        )}
      >
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
        Publish help requested — awaiting admin review
      </span>
    )
  }

  function submit() {
    startTransition(async () => {
      const res = await fetch(`/api/coordinator/events/${eventId}/publish-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestNote: note }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not send publish assist request')
        return
      }

      toast.success('Request sent — we will notify you when reviewed.')
      setOpen(false)
      setNote('')
      onRequested?.()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant={variant} size={size} className={cn('gap-1.5', className)} />
        }
      >
        <LifeBuoy className="h-4 w-4" aria-hidden />
        Request admin help to publish
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request admin help to publish</DialogTitle>
          <DialogDescription>
            A platform admin can review your organizer account and publish this market on your
            behalf. They will not edit your market details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="publish-assist-note">Note for admin (optional)</Label>
          <Textarea
            id="publish-assist-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Offline community market — organization details submitted."
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              'Send request'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
