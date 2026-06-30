'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Mail } from 'lucide-react'
import { toast } from '@/lib/toast'

interface ChangeEmailDialogProps {
  currentEmail: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ChangeEmailDialog({ currentEmail, open, onOpenChange }: ChangeEmailDialogProps) {
  const supabase = createClient()
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)

  function resetForm() {
    setNewEmail('')
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm()
    onOpenChange(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = newEmail.trim()
    if (!trimmed || !trimmed.includes('@')) {
      toast.error('Enter a valid email address')
      return
    }
    if (trimmed.toLowerCase() === currentEmail.toLowerCase()) {
      toast.error('That is already your email address')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed })
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Confirmation sent — check your new inbox to verify the change.')
      handleOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change email address</DialogTitle>
          <DialogDescription>
            We will send a confirmation link to your new address. Your sign-in email updates after you
            confirm. Current: {currentEmail}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-email">New email</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="you@example.com"
              className="h-11"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" aria-hidden />
                  Send confirmation
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
