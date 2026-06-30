'use client'

import { Copy, Link2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  isMarketPublishedForVendors,
  vendorMarketInviteUrl,
} from '@/lib/coordinator/vendor-outreach'

interface VendorRecruitmentCalloutProps {
  eventId?: string
  eventName?: string
  eventStatus?: string
  variant?: 'card' | 'compact'
  className?: string
}

function copyToClipboard(text: string, successMessage: string) {
  void navigator.clipboard.writeText(text).then(
    () => toast.success(successMessage),
    () => toast.error('Could not copy link')
  )
}

export function VendorRecruitmentCallout({
  eventId,
  eventName,
  eventStatus,
  variant = 'card',
  className,
}: VendorRecruitmentCalloutProps) {
  const compact = variant === 'compact'
  const inviteUrl = eventId ? vendorMarketInviteUrl(eventId) : null
  const published = eventStatus ? isMarketPublishedForVendors(eventStatus) : true

  if (!inviteUrl) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-stone-300 px-3 py-3 text-xs text-muted-foreground',
          className
        )}
      >
        Create a market first, then copy your vendor invite link from here.
      </div>
    )
  }

  return (
    <div
      className={cn(
        compact
          ? 'rounded-xl border border-dashed border-harvest-200 bg-harvest-50/60 p-3'
          : 'rounded-xl border border-harvest-200 bg-harvest-50/80 p-4 shadow-sm',
        className
      )}
    >
      <div className={cn('space-y-1', compact ? 'mb-2.5' : 'mb-3')}>
        <p className={cn('font-heading font-semibold text-harvest-900', compact ? 'text-sm' : 'text-base')}>
          Share with vendors
        </p>
        <p className={cn('leading-snug text-harvest-900/80', compact ? 'text-[10px]' : 'text-xs')}>
          One link for Facebook, email, or Instagram. Makers sign up as vendors, then land straight on
          {eventName ? ` ${eventName}` : ' your market'} to apply.
          {!published ? ' Publish your market first so applications are open.' : ''}
        </p>
      </div>

      <div
        className={cn(
          'flex items-start gap-2 rounded-lg border border-stone-200 bg-white',
          compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
        )}
      >
        <span
          className={cn(
            'flex shrink-0 items-center justify-center rounded-md bg-forest/10 text-forest',
            compact ? 'h-7 w-7' : 'h-8 w-8'
          )}
          aria-hidden
        >
          <Link2 className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>
            Vendor invite link
          </p>
          <p
            className={cn(
              'mt-1.5 break-all font-mono text-forest/90',
              compact ? 'text-[10px]' : 'text-[11px]'
            )}
          >
            {inviteUrl}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('shrink-0 gap-1', compact && 'h-8 px-2 text-[10px]')}
          onClick={() => copyToClipboard(inviteUrl, 'Vendor invite link copied')}
        >
          <Copy className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} aria-hidden />
          Copy
        </Button>
      </div>
    </div>
  )
}
