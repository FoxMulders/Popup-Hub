'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { Gavel, Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCredits } from '@/lib/quarter-auction/credits'
import { buildVendorProfileHref } from '@/lib/shopper/vendors'
import type { BackedItem } from '@/lib/market-night/summary'

interface BackedItemsSectionProps {
  items: BackedItem[]
  eventId: string
}

export function BackedItemsSection({ items, eventId }: BackedItemsSectionProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed bg-white px-6 py-12 text-center">
        <Gavel className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
        <p className="font-medium text-foreground">No auction entries</p>
        <p className="mt-1 max-w-sm mx-auto text-sm text-muted-foreground">
          You did not place paddle entries on catalog items at this market&apos;s quarter auction.
        </p>
        <Link href={`/events/${eventId}/quarter-auction`} className="mt-4 inline-block text-sm font-medium text-harvest-700 hover:underline">
          Learn about quarter auctions →
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <BackedItemCard key={item.catalogItemId} item={item} eventId={eventId} />
      ))}
    </div>
  )
}

function BackedItemCard({ item, eventId }: { item: BackedItem; eventId: string }) {
  const vendorHref = buildVendorProfileHref(eventId, item.vendorId)

  return (
    <article className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row">
        {item.imageUrl ? (
          <div className="sm:w-36 shrink-0 bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.imageUrl}
              alt=""
              className="h-32 w-full object-cover sm:h-full sm:min-h-[120px]"
            />
          </div>
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <Link
                href={vendorHref}
                className="mt-0.5 text-sm text-harvest-700 hover:underline"
              >
                {item.vendorName}
              </Link>
            </div>
            {item.won ? (
              <Badge className="gap-1 bg-amber-100 text-amber-900">
                <Trophy className="h-3 w-3" />
                You won!
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                Backed
              </Badge>
            )}
          </div>

          {item.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {item.entries.map((entry) => (
              <span
                key={entry.entryId}
                className="inline-flex items-center rounded-full bg-canvas px-2.5 py-1 text-xs font-medium tabular-nums text-foreground"
              >
                Paddle #{entry.paddleNumber} · {formatCredits(entry.creditsSpent)}
              </span>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {formatCredits(item.totalCreditsSpent)} total · first entry{' '}
            {item.entries[0]
              ? format(new Date(item.entries[0].enteredAt), 'MMM d, h:mm a')
              : ''}
            {item.winningPaddleNumber && !item.won
              ? ` · winning paddle #${item.winningPaddleNumber}`
              : ''}
          </p>
        </div>
      </div>
    </article>
  )
}
