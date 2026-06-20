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

type OrganizerOption = Pick<Organizer, 'slug' | 'display_name' | 'city'>

function organizerOptionLabel(org: OrganizerOption) {
  return `${org.display_name} · ${org.city}`
}

type Props = {
  organizers: OrganizerOption[]
  initialOrganizerSlug?: string
  initialEventName?: string
  initialEventMonthYear?: string
  canSubmit: boolean
  isSignedIn: boolean
  returnPath: string
}

export function OrganizerReviewForm({
  organizers,
  initialOrganizerSlug,
  initialEventName,
  initialEventMonthYear,
  canSubmit,
  isSignedIn,
  returnPath,
}: Props) {
  const router = useRouter()
  const [organizerMode, setOrganizerMode] = useState<'listed' | 'not_listed'>(
    initialOrganizerSlug ? 'listed' : 'listed'
  )
  const [organizerSlug, setOrganizerSlug] = useState(initialOrganizerSlug ?? '')
  const [suggestDisplayName, setSuggestDisplayName] = useState('')
  const [suggestCity, setSuggestCity] = useState('')
  const [suggestWebsiteUrl, setSuggestWebsiteUrl] = useState('')
  const [suggestFacebookUrl, setSuggestFacebookUrl] = useState('')
  const [suggestContactName, setSuggestContactName] = useState('')
  const [eventName, setEventName] = useState(initialEventName ?? '')
  const [eventMonthYear, setEventMonthYear] = useState(initialEventMonthYear ?? '')
  const [eventAsAdvertised, setEventAsAdvertised] = useState('')
  const [wouldReturn, setWouldReturn] = useState('')
  const [attendance, setAttendance] = useState('')
  const [communicationRating, setCommunicationRating] = useState('')
  const [refundExperience, setRefundExperience] = useState('na')
  const [optionalNotes, setOptionalNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [enablingVendor, setEnablingVendor] = useState(false)
  const [submittedPending, setSubmittedPending] = useState(false)

  const sortedOrganizers = useMemo(
    () => [...organizers].sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [organizers]
  )

  const canSubmitForm =
    organizerMode === 'listed'
      ? Boolean(organizerSlug)
      : suggestDisplayName.trim().length >= 2 && suggestCity.trim().length >= 2

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
    if (!canSubmit || !canSubmitForm) return

    setLoading(true)
    try {
      const body =
        organizerMode === 'not_listed'
          ? {
              notListed: true,
              suggestOrganizer: {
                displayName: suggestDisplayName.trim(),
                city: suggestCity.trim(),
                websiteUrl: suggestWebsiteUrl.trim() || undefined,
                facebookUrl: suggestFacebookUrl.trim() || undefined,
                contactName: suggestContactName.trim() || undefined,
              },
              eventName,
              eventMonthYear,
              eventAsAdvertised,
              wouldReturn: wouldReturn === 'yes',
              attendanceVsExpectations: attendance,
              communicationRating: Number(communicationRating),
              refundExperience,
              optionalNotes,
            }
          : {
              organizerSlug,
              eventName,
              eventMonthYear,
              eventAsAdvertised,
              wouldReturn: wouldReturn === 'yes',
              attendanceVsExpectations: attendance,
              communicationRating: Number(communicationRating),
              refundExperience,
              optionalNotes,
            }

      const res = await fetch('/api/organizers/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as {
        error?: string
        status?: string
        organizerSlug?: string
        organizerName?: string
      }

      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit review')
        return
      }

      if (data.status === 'pending_moderation') {
        setSubmittedPending(true)
        toast.success(
          'Thanks — your review is saved and will appear after we verify this organizer.'
        )
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

  if (submittedPending) {
    return (
      <div className="rounded-xl border bg-harvest-50/50 border-harvest-200 p-6 space-y-3 text-sm">
        <p className="font-medium text-foreground">Review submitted for moderation</p>
        <p className="text-muted-foreground">
          We will verify {suggestDisplayName.trim() || 'this organizer'} and publish your review on
          their trust report. Check back on{' '}
          <Link href="/check" className="text-harvest-800 underline underline-offset-2">
            organizer search
          </Link>{' '}
          in a few days.
        </p>
        <Link
          href="/check"
          className="inline-flex text-sm font-medium text-harvest-800 hover:underline underline-offset-2"
        >
          Back to organizer search
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
      <div className="space-y-2">
        <Label htmlFor="organizer-mode">Organizer</Label>
        <Select
          value={organizerMode}
          onValueChange={(value) => {
            const mode = value === 'not_listed' ? 'not_listed' : 'listed'
            setOrganizerMode(mode)
            if (mode === 'not_listed') setOrganizerSlug('')
          }}
        >
          <SelectTrigger id="organizer-mode" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="listed">Select from list</SelectItem>
            <SelectItem value="not_listed">Organizer not listed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {organizerMode === 'listed' ? (
        <div className="space-y-2">
          <Label htmlFor="organizer">Which organizer?</Label>
          <Select
            value={organizerSlug}
            onValueChange={(value) => setOrganizerSlug(value ?? '')}
            required
          >
            <SelectTrigger id="organizer" className="w-full">
              <SelectValue placeholder="Select organizer…">
                {(value) => {
                  if (!value) return 'Select organizer…'
                  const org = sortedOrganizers.find((o) => o.slug === value)
                  return org ? organizerOptionLabel(org) : value
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortedOrganizers.map((org) => (
                <SelectItem key={org.slug} value={org.slug}>
                  {organizerOptionLabel(org)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-dashed bg-canvas/60 p-4">
          <p className="text-xs text-muted-foreground">
            Tell us who ran the market. We verify new organizers before they appear in search; your
            review is saved and published together with their listing.
          </p>
          <div className="space-y-2">
            <Label htmlFor="suggest-name">Organizer or business name</Label>
            <Input
              id="suggest-name"
              value={suggestDisplayName}
              onChange={(e) => setSuggestDisplayName(e.target.value)}
              placeholder="e.g. Hope & Holly Markets"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-city">City</Label>
            <Input
              id="suggest-city"
              value={suggestCity}
              onChange={(e) => setSuggestCity(e.target.value)}
              placeholder="e.g. Edmonton"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-contact">Contact name (optional)</Label>
            <Input
              id="suggest-contact"
              value={suggestContactName}
              onChange={(e) => setSuggestContactName(e.target.value)}
              placeholder="Person you dealt with"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-website">Website (optional)</Label>
            <Input
              id="suggest-website"
              value={suggestWebsiteUrl}
              onChange={(e) => setSuggestWebsiteUrl(e.target.value)}
              placeholder="https://…"
              type="url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="suggest-facebook">Facebook group or page (optional)</Label>
            <Input
              id="suggest-facebook"
              value={suggestFacebookUrl}
              onChange={(e) => setSuggestFacebookUrl(e.target.value)}
              placeholder="https://facebook.com/…"
              type="url"
            />
          </div>
        </div>
      )}

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
          <SelectTrigger className="w-full">
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
          <SelectTrigger className="w-full">
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
          <SelectTrigger className="w-full">
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
          <SelectTrigger className="w-full">
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
          <SelectTrigger className="w-full">
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

      <Button type="submit" disabled={loading || !canSubmitForm} className="w-full sm:w-auto">
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
