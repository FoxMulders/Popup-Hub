'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Organizer } from '@/types/organizers'

type Props = {
  organizers: Pick<Organizer, 'slug' | 'display_name' | 'city'>[]
  initialOrganizerSlug?: string
  canSubmit: boolean
  isSignedIn: boolean
  returnPath: string
}

export function OrganizerReviewForm({
  organizers,
  initialOrganizerSlug,
  canSubmit,
  isSignedIn,
  returnPath,
}: Props) {
  const router = useRouter()
  const [organizerSlug, setOrganizerSlug] = useState(initialOrganizerSlug ?? '')
  const [eventName, setEventName] = useState('')
  const [eventMonthYear, setEventMonthYear] = useState('')
  const [eventAsAdvertised, setEventAsAdvertised] = useState('')
  const [wouldReturn, setWouldReturn] = useState('')
  const [attendance, setAttendance] = useState('')
  const [communicationRating, setCommunicationRating] = useState('')
  const [refundExperience, setRefundExperience] = useState('na')
  const [optionalNotes, setOptionalNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [enablingVendor, setEnablingVendor] = useState(false)

  const sortedOrganizers = useMemo(
    () => [...organizers].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [organizers]
  )

  async function enableVendorAccess() {
    setEnablingVendor(true)
    try {
      const res = await fetch('/api/profile/enable-vendor', { method: 'POST' })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not enable vendor access')
        return
      }
      toast.success('Vendor access enabled — you can submit your review now.')
      router.refresh()
    } finally {
      setEnablingVendor(false)
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    try {
      const res = await fetch('/api/organizers/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizerSlug,
          eventName,
          eventMonthYear,
          eventAsAdvertised,
          wouldReturn: wouldReturn === 'yes',
          attendanceVsExpectations: attendance,
          communicationRating: Number(communicationRating),
          refundExperience,
          optionalNotes,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        organizerSlug?: string
        organizerName?: string
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit review')
        return
      }

      toast.success(`Review posted for ${data.organizerName ?? 'this organizer'}.`)
      router.push(`/organizers/${data.organizerSlug ?? organizerSlug}`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!isSignedIn) {
    return (
      <div className="rounded-xl border bg-white p-6 space-y-4 text-sm">
        <p className="text-muted-foreground">
          Sign in with a vendor account to review organizers you have vended with.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/login?next=${encodeURIComponent(returnPath)}`}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Sign in
          </Link>
          <Link
            href={`/signup?role=vendor&next=${encodeURIComponent(returnPath)}`}
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium"
          >
            Create vendor account
          </Link>
        </div>
      </div>
    )
  }

  if (!canSubmit) {
    return (
      <div className="rounded-xl border bg-white p-6 space-y-4 text-sm">
        <p className="text-muted-foreground">
          Reviews come from vendors who actually vended at a market. Enable vendor access on your
          account (free) — you do not need to apply through PopUp Hub to review past markets.
        </p>
        <Button type="button" onClick={() => void enableVendorAccess()} disabled={enablingVendor}>
          {enablingVendor ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Enabling…
            </>
          ) : (
            'Enable vendor access'
          )}
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
      <div className="space-y-2">
        <Label htmlFor="organizer">Organizer</Label>
        <Select
          value={organizerSlug}
          onValueChange={(value) => setOrganizerSlug(value ?? '')}
          required
        >
          <SelectTrigger id="organizer">
            <SelectValue placeholder="Select organizer…" />
          </SelectTrigger>
          <SelectContent>
            {sortedOrganizers.map((org) => (
              <SelectItem key={org.slug} value={org.slug}>
                {org.display_name} · {org.city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventName">Market or event name</Label>
        <Input
          id="eventName"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="e.g. Hope & Holly Christmas in July Market"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="eventMonthYear">When did you vend there?</Label>
        <Input
          id="eventMonthYear"
          type="month"
          value={eventMonthYear}
          onChange={(e) => setEventMonthYear(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <Label>Event as advertised?</Label>
        <Select value={eventAsAdvertised} onValueChange={(v) => setEventAsAdvertised(v ?? '')} required>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes — matched the listing</SelectItem>
            <SelectItem value="partial">Partially — some surprises</SelectItem>
            <SelectItem value="no">No — not as advertised</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Would you return?</Label>
        <Select value={wouldReturn} onValueChange={(v) => setWouldReturn(v ?? '')} required>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Foot traffic vs your expectations</Label>
        <Select value={attendance} onValueChange={(v) => setAttendance(v ?? '')} required>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="much_lower">Much quieter than expected</SelectItem>
            <SelectItem value="lower">Quieter than expected</SelectItem>
            <SelectItem value="about_right">About what I expected</SelectItem>
            <SelectItem value="higher">Busier than expected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Organizer communication (1–5)</Label>
        <Select
          value={communicationRating}
          onValueChange={(v) => setCommunicationRating(v ?? '')}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} — {n === 5 ? 'Excellent' : n === 1 ? 'Poor' : 'OK'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Refund experience (if applicable)</Label>
        <Select value={refundExperience} onValueChange={(v) => setRefundExperience(v ?? 'na')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="na">N/A — no refund needed</SelectItem>
            <SelectItem value="fast">Refund was fast</SelectItem>
            <SelectItem value="slow">Refund was slow</SelectItem>
            <SelectItem value="never_received">Never received a refund</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Optional notes</Label>
        <Textarea
          id="notes"
          value={optionalNotes}
          onChange={(e) => setOptionalNotes(e.target.value)}
          placeholder="Anything else vendors should know before paying?"
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading || !organizerSlug} className="w-full sm:w-auto">
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Submitting…
          </>
        ) : (
          'Submit review'
        )}
      </Button>
    </form>
  )
}
