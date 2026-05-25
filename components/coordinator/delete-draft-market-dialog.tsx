'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Loader2, Trash2 } from 'lucide-react'
import { revalidateMarketsCacheClient } from '@/lib/cache/revalidate-markets-client'

const CONFIRM_WORD = 'DELETE'

interface DeleteDraftMarketDialogProps {
  eventId: string
  eventName?: string
  redirectTo?: string
  triggerClassName?: string
}

export function DeleteDraftMarketDialog({
  eventId,
  eventName,
  redirectTo = '/coordinator/dashboard',
  triggerClassName,
}: DeleteDraftMarketDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_WORD

  async function handleDelete() {
    if (!canConfirm) return
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? 'Could not delete draft market')
        return
      }
      toast.success('Draft market deleted')
      setOpen(false)
      setConfirmText('')
      await revalidateMarketsCacheClient()
      router.push(redirectTo)
      router.refresh()
    } catch {
      toast.error('Could not delete draft market')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setConfirmText('')
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={
              triggerClassName ??
              'gap-1.5 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800'
            }
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete draft
          </Button>
        }
      />
      <AlertDialogContent className="max-w-md border-red-200">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-800">Delete draft market?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-left text-sm text-foreground">
            <p>
              This permanently removes{' '}
              <span className="font-semibold">{eventName?.trim() || 'this draft'}</span> and its
              saved setup (venue, categories, layout). This cannot be undone.
            </p>
            <p className="text-muted-foreground">
              Type <span className="font-mono font-semibold text-red-700">{CONFIRM_WORD}</span> to
              confirm.
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={CONFIRM_WORD}
              autoComplete="off"
              className="font-mono"
            />
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Keep draft</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || loading}
            onClick={() => void handleDelete()}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Delete permanently
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
