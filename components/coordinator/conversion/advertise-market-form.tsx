'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Megaphone } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { coordinatorCampaignHref } from '@/lib/coordinator/conversion-listing'

interface AdvertiseMarketFormProps {
  className?: string
}

function defaultStartDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  return date.toISOString().slice(0, 10)
}

function defaultEndDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 14)
  date.setHours(17, 0, 0, 0)
  return date.toISOString().slice(0, 10)
}

function toIsoDateTime(dateOnly: string, hour: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString()
}

export function AdvertiseMarketForm({ className }: AdvertiseMarketFormProps) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [destinationUrl, setDestinationUrl] = useState('')
  const [locationName, setLocationName] = useState('')
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return

    setError(null)
    setSubmitting(true)

    try {
      const response = await fetch('/api/coordinator/events/advertise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          name,
          destinationUrl,
          locationName: locationName || undefined,
          startAt: toIsoDateTime(startDate, 9),
          endAt: toIsoDateTime(endDate, 17),
          activateCampaign: true,
        }),
      })

      const payload = (await response.json()) as { eventId?: string; error?: string }

      if (!response.ok || !payload.eventId) {
        throw new Error(payload.error ?? 'Could not create ad listing')
      }

      router.push(coordinatorCampaignHref(payload.eventId))
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('flex flex-col gap-5', className)}>
      <div className="rounded-xl border border-amber-200/70 bg-amber-50/40 px-4 py-3 text-sm text-amber-950">
        <p className="font-medium">Ad listing tier</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
          Your market appears on Discover with a trackable link to your website. Booth layout and
          vendor tools stay locked until you upgrade to native (free during beta). Campaign billing
          is stubbed for MVP — activation is immediate.
        </p>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Market name</span>
        <input
          required
          minLength={3}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2"
          placeholder="Summer Makers Market"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Destination URL</span>
        <input
          required
          type="url"
          value={destinationUrl}
          onChange={(e) => setDestinationUrl(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2"
          placeholder="https://yourmarket.ca"
        />
        <span className="text-xs text-muted-foreground">
          Shoppers tap through from Discover to this link (tracked daily per visitor).
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-foreground">Venue name (optional)</span>
        <input
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2"
          placeholder="Community hall or park"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">Market date</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">End date</span>
          <input
            required
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2"
          />
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <button
        type="submit"
        disabled={submitting}
        className={cn(buttonVariants(), 'gap-2 w-full sm:w-auto sm:self-start')}
      >
        <Megaphone className="h-4 w-4" aria-hidden />
        {submitting ? 'Creating…' : 'Activate campaign (beta — free)'}
      </button>
    </form>
  )
}
