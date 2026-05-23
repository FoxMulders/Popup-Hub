'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EventStatusToggle } from '@/components/coordinator/event-status-toggle'
import { MapPin, Calendar, Clock, Pencil, Loader2, CheckCircle } from 'lucide-react'
import { format } from 'date-fns'
import type { Event } from '@/types/database'

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
  const opts: { value: string; label: string }[] = []
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      if (h === 23 && m === 30) break
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      const period = h < 12 ? 'AM' : 'PM'
      const displayH = h % 12 === 0 ? 12 : h % 12
      opts.push({ value: `${hh}:${mm}`, label: `${displayH}:${mm} ${period}` })
    }
  }
  return opts
})()

type EditingField = 'title' | 'description' | 'location' | 'dates'

interface EventInlineEditorProps {
  event: Event
}

export function EventInlineEditor({ event }: EventInlineEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [, startTransition] = useTransition()

  const isLocked = event.status === 'completed' || event.status === 'cancelled'
  const isPublishedOrActive = event.status === 'published' || event.status === 'active'

  const [editing, setEditing] = useState<EditingField | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedField, setSavedField] = useState<EditingField | null>(null)

  const [titleValue, setTitleValue] = useState(event.name)
  const [descValue, setDescValue] = useState(event.description ?? '')
  const [locationName, setLocationName] = useState(event.location_name)
  const [address, setAddress] = useState(event.address)
  const [startDate, setStartDate] = useState(event.start_at.slice(0, 10))
  const [startTime, setStartTime] = useState(event.start_at.slice(11, 16))
  const [endDate, setEndDate] = useState(event.end_at.slice(0, 10))
  const [endTime, setEndTime] = useState(event.end_at.slice(11, 16))
  const [dateWarningConfirmed, setDateWarningConfirmed] = useState(false)

  function startEditing(field: EditingField) {
    setEditing(field)
    setSavedField(null)
    if (field === 'title') setTitleValue(event.name)
    if (field === 'description') setDescValue(event.description ?? '')
    if (field === 'location') {
      setLocationName(event.location_name)
      setAddress(event.address)
    }
    if (field === 'dates') {
      setStartDate(event.start_at.slice(0, 10))
      setStartTime(event.start_at.slice(11, 16))
      setEndDate(event.end_at.slice(0, 10))
      setEndTime(event.end_at.slice(11, 16))
      setDateWarningConfirmed(false)
    }
  }

  function cancelEditing() {
    setEditing(null)
  }

  async function saveField(field: EditingField) {
    setSaving(true)
    try {
      let payload: Record<string, unknown> = {}

      if (field === 'title') {
        payload = { name: titleValue.trim() }
      } else if (field === 'description') {
        payload = { description: descValue.trim() || null }
      } else if (field === 'location') {
        payload = { location_name: locationName.trim(), address: address.trim() }
      } else if (field === 'dates') {
        payload = {
          start_at: new Date(`${startDate}T${startTime}`).toISOString(),
          end_at: new Date(`${endDate}T${endTime}`).toISOString(),
        }
      }

      const { error } = await supabase.from('events').update(payload).eq('id', event.id)
      if (error) throw error

      setEditing(null)
      setSavedField(field)
      setTimeout(() => setSavedField(null), 1500)
      startTransition(() => router.refresh())
    } catch {
      // silent – could wire up a toast here
    } finally {
      setSaving(false)
    }
  }

  function pencilButton(field: EditingField, label: string) {
    if (isLocked) return null
    return (
      <button
        type="button"
        aria-label={`Edit ${label}`}
        className="opacity-0 group-hover:opacity-100 ml-1.5 transition-opacity focus:opacity-100"
        onClick={() => startEditing(field)}
      >
        <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-amber-500" />
      </button>
    )
  }

  function savedCheck(field: EditingField) {
    if (savedField !== field) return null
    return <CheckCircle className="inline h-3.5 w-3.5 text-green-500 ml-1" />
  }

  function saveCancelRow(field: EditingField, canSave = true) {
    return (
      <div className="mt-2 flex items-center gap-2">
        <Button
          size="sm"
          className="h-7 bg-amber-500 px-3 text-xs text-white hover:bg-amber-600"
          onClick={() => saveField(field)}
          disabled={saving || !canSave}
        >
          {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-3 text-xs"
          onClick={cancelEditing}
          disabled={saving}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 transition-all duration-200">
      <div className="min-w-0 flex-1">
        {/* ── Title ─────────────────────────────── */}
        {editing === 'title' ? (
          <div>
            <Input
              value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              className="text-xl font-bold"
              aria-label="Edit event title"
              autoFocus
            />
            {saveCancelRow('title')}
          </div>
        ) : (
          <div className="group flex items-center">
            <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
            {pencilButton('title', 'event title')}
            {savedCheck('title')}
          </div>
        )}

        {/* ── Description ───────────────────────── */}
        <div className="mt-1">
          {editing === 'description' ? (
            <div>
              <Textarea
                value={descValue}
                onChange={(e) => setDescValue(e.target.value)}
                rows={3}
                aria-label="Edit description"
                autoFocus
              />
              {saveCancelRow('description')}
            </div>
          ) : event.description ? (
            <div className="group flex items-start">
              <p className="text-sm text-gray-500">{event.description}</p>
              {pencilButton('description', 'description')}
              {savedCheck('description')}
            </div>
          ) : (
            <div className="group flex items-center">
              <span className="text-sm italic text-gray-400">No description</span>
              {pencilButton('description', 'description')}
            </div>
          )}
        </div>

        {/* ── Location + Dates row ───────────────── */}
        <div className="mt-2 flex flex-wrap items-start gap-3 text-sm text-gray-500">
          {/* Location */}
          {editing === 'location' ? (
            <div className="w-full">
              <div className="flex gap-2">
                <Input
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="Venue Name"
                  className="flex-1"
                  aria-label="Edit venue name"
                  autoFocus
                />
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Address"
                  className="flex-1"
                  aria-label="Edit address"
                />
              </div>
              {saveCancelRow('location')}
            </div>
          ) : (
            <div className="group flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-amber-500" />
              <span>{event.location_name}</span>
              {pencilButton('location', 'location')}
              {savedCheck('location')}
            </div>
          )}

          {/* Dates + times */}
          {editing === 'dates' ? (
            <div className="w-full">
              {isPublishedOrActive && (
                <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  <p>⚠ Changing dates on a published event will notify all applied vendors.</p>
                  <label className="mt-2 flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={dateWarningConfirmed}
                      onChange={(e) => setDateWarningConfirmed(e.target.checked)}
                      className="rounded"
                    />
                    <span>I understand, proceed with the date change</span>
                  </label>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-36"
                  />
                  <Select value={startTime} onValueChange={(v) => { if (v) setStartTime(v) }}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="self-center text-gray-400">–</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-36"
                  />
                  <Select value={endTime} onValueChange={(v) => { if (v) setEndTime(v) }}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {saveCancelRow('dates', !isPublishedOrActive || dateWarningConfirmed)}
            </div>
          ) : (
            <>
              <div className="group flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-500" />
                <span>{format(new Date(event.start_at), 'EEE, MMM d, yyyy')}</span>
                {pencilButton('dates', 'dates')}
                {savedCheck('dates')}
              </div>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                {format(new Date(event.start_at), 'h:mm a')} –{' '}
                {format(new Date(event.end_at), 'h:mm a')}
              </span>
            </>
          )}
        </div>

        {/* ── Locked banner ─────────────────────── */}
        {isLocked && (
          <p className="mt-2 text-xs italic text-red-500">
            {event.status === 'cancelled'
              ? 'This event is cancelled and cannot be edited.'
              : 'This event is locked.'}
          </p>
        )}
      </div>

      <div id="event-status" className="scroll-mt-24">
        <EventStatusToggle event={event} />
      </div>
    </div>
  )
}
