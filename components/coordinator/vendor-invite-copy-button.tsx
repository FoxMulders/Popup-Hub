'use client'

import { Copy } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { vendorMarketInviteUrl } from '@/lib/coordinator/vendor-outreach'
import { cn } from '@/lib/utils'

interface VendorInviteCopyButtonProps {
  eventId: string
  eventName?: string
  className?: string
  size?: 'sm' | 'default'
}

export function VendorInviteCopyButton({
  eventId,
  eventName,
  className,
  size = 'sm',
}: VendorInviteCopyButtonProps) {
  const inviteUrl = vendorMarketInviteUrl(eventId)

  function handleCopy() {
    void navigator.clipboard.writeText(inviteUrl).then(
      () =>
        toast.success(
          eventName ? `Invite link copied for ${eventName}` : 'Vendor invite link copied'
        ),
      () => toast.error('Could not copy link')
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      className={cn('shrink-0 gap-1', className)}
      onClick={handleCopy}
      title={inviteUrl}
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      Copy invite link
    </Button>
  )
}
