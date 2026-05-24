'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Megaphone } from 'lucide-react'

interface VendorAnnouncementProps {
  eventId: string
  eventName: string
  approvedVendorIds: string[]
}

export function VendorAnnouncement({
  eventId,
  eventName,
  approvedVendorIds,
}: VendorAnnouncementProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  if (approvedVendorIds.length === 0) return null

  async function handleSend() {
    if (!subject.trim() || !message.trim()) {
      toast.error('Please fill in both subject and message.')
      return
    }

    setSending(true)
    try {
      const notifications = approvedVendorIds.map((vendorId) => ({
        user_id: vendorId,
        type: 'coordinator_announcement' as const,
        message: `[${subject}] ${message}`,
        is_read: false,
        metadata: { event_id: eventId, event_name: eventName, subject },
      }))

      const { error } = await supabase.from('notifications').insert(notifications)

      if (error) throw error

      toast.success(
        `Message sent to ${approvedVendorIds.length} vendor${approvedVendorIds.length === 1 ? '' : 's'}`
      )
      setSubject('')
      setMessage('')
      setOpen(false)
    } catch {
      toast.error('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => setOpen(true)}
      >
        <Megaphone className="h-4 w-4" />
        Message Vendors
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Message All Approved Vendors</DialogTitle>
            <DialogDescription>
              This will send a notification to all {approvedVendorIds.length} approved vendor
              {approvedVendorIds.length === 1 ? '' : 's'} for <strong>{eventName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="e.g. Important parking update"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                maxLength={120}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between">
                <Label htmlFor="message">Message</Label>
                <span className="text-xs text-muted-foreground">{message.length}/500</span>
              </div>
              <Textarea
                id="message"
                placeholder="Type your message here…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={5}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSend}
              disabled={sending || !subject.trim() || !message.trim()}
            >
              {sending
                ? 'Sending…'
                : `Send to ${approvedVendorIds.length} vendor${approvedVendorIds.length === 1 ? '' : 's'}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
