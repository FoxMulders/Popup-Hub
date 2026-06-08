'use client'

import { useState } from 'react'
import { Navigation, Share2, Bell, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { openDirections } from '@/lib/shopper/geo'
import { AddToCalendarButton } from '@/components/shopper/add-to-calendar-button'
import { FavoriteButton } from '@/components/shopper/favorite-button'
import { ReminderPicker } from '@/components/shopper/reminder-picker'
import { toast } from 'sonner'
import type { Event } from '@/types/database'

interface EventActionBarProps {
  event: Event
  favorited: boolean
  userId: string | null
  existingReminderOffsets: string[]
}

export function EventActionBar({
  event,
  favorited,
  userId,
  existingReminderOffsets,
}: EventActionBarProps) {
  const [reminderOpen, setReminderOpen] = useState(false)

  async function shareEvent() {
    const url = `${window.location.origin}/events/${event.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: event.name, url })
        return
      } catch {
        /* fall through */
      }
    }
    await navigator.clipboard.writeText(url)
    toast.success('Link copied')
  }

  return (
    <>
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 border-t border-stone-200 bg-cream/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-2">
          <Button
            type="button"
            className="min-h-11 flex-1 gap-1.5 bg-forest hover:bg-forest-deep sm:flex-none"
            onClick={() => openDirections(event.latitude, event.longitude, event.address)}
          >
            <Navigation className="h-4 w-4" />
            Directions
          </Button>
          <FavoriteButton eventId={event.id} initialFavorited={favorited} size="sm" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 gap-1"
            onClick={() => {
              if (!userId) {
                toast.error('Sign in to set reminders')
                return
              }
              setReminderOpen(true)
            }}
          >
            <Bell className="h-4 w-4" />
            Remind
          </Button>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={shareEvent}>
            <Share2 className="h-4 w-4" />
          </Button>
          <AddToCalendarButton event={event} className="min-h-11" labelVisibility="mobile" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11 hidden sm:inline-flex"
            onClick={async () => {
              await navigator.clipboard.writeText(event.address)
              toast.success('Address copied')
            }}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ReminderPicker
        open={reminderOpen}
        onOpenChange={setReminderOpen}
        eventId={event.id}
        eventStartAt={event.start_at}
        existingOffsets={existingReminderOffsets}
      />
    </>
  )
}
