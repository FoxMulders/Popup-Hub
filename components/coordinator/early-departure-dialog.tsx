'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { AlertTriangle } from 'lucide-react'

interface EarlyDepartureDialogProps {
  vendorName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (notes: string) => Promise<void>
}

export function EarlyDepartureDialog({
  vendorName,
  open,
  onOpenChange,
  onConfirm,
}: EarlyDepartureDialogProps) {
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm(notes.trim())
      setNotes('')
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-terracotta-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-terracotta-800">
            <AlertTriangle className="h-5 w-5" />
            Log early departure
          </DialogTitle>
          <DialogDescription>
            Confirm that <span className="font-medium text-foreground">{vendorName}</span> packed up
            before the market ended. This reduces their reliability score and is recorded on their
            vendor profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="early-notes">Incident notes (optional)</Label>
          <Textarea
            id="early-notes"
            placeholder="e.g. Left at 11am, booth still had inventory on table…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            className="bg-terracotta-600 hover:bg-terracotta-700 text-white"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? 'Saving…' : 'Confirm early departure'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
