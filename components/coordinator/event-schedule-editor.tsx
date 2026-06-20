'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { safeFormatMarketDate } from '@/lib/format/safe-event-date'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import type { Event, EventScheduleItem } from '@/types/database'
import { Trash2 } from 'lucide-react'

interface EventScheduleEditorProps {
  event: Event
  items: EventScheduleItem[]
}

export function EventScheduleEditor({ event, items: initial }: EventScheduleEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [items, setItems] = useState(initial)
  const [title, setTitle] = useState('')
  const [locationLabel, setLocationLabel] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function addItem() {
    if (!title.trim() || !startsAt) {
      toast.error('Title and start time are required')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('event_schedule_items')
      .insert({
        event_id: event.id,
        title: title.trim(),
        location_label: locationLabel.trim() || null,
        starts_at: new Date(startsAt).toISOString(),
        ends_at: endsAt ? new Date(endsAt).toISOString() : null,
        description: description.trim() || null,
        sort_order: items.length,
      })
      .select('*')
      .single()
    setSaving(false)
    if (error || !data) {
      toast.error('Could not add schedule item')
      return
    }
    setItems((list) => [...list, data as EventScheduleItem])
    setTitle('')
    setLocationLabel('')
    setStartsAt('')
    setEndsAt('')
    setDescription('')
    toast.success('Schedule item added')
    router.refresh()
  }

  async function removeItem(id: string) {
    const { error } = await supabase.from('event_schedule_items').delete().eq('id', id)
    if (error) {
      toast.error('Could not remove item')
      return
    }
    setItems((list) => list.filter((i) => i.id !== id))
    router.refresh()
  }

  return (
    <div className="market-panel space-y-4 p-5">
      <div>
        <h3 className="font-heading font-semibold">Live schedule</h3>
        <p className="text-sm text-muted-foreground">
          Stage times, workshops, and announcements shoppers see on the market page.
        </p>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">
                  {safeFormatMarketDate(item.starts_at, 'MMM d · h:mm a', 'Time TBD')}
                  {item.ends_at
                    ? ` – ${safeFormatMarketDate(item.ends_at, 'h:mm a', '')}`
                    : ''}
                  {item.location_label ? ` · ${item.location_label}` : ''}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="shrink-0 text-red-600"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="sched-title">Title</Label>
          <Input
            id="sched-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Opening ceremony"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sched-start">Starts</Label>
          <Input
            id="sched-start"
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sched-end">Ends (optional)</Label>
          <Input
            id="sched-end"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sched-location">Location label</Label>
          <Input
            id="sched-location"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="Main stage"
          />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="sched-desc">Description (optional)</Label>
          <Textarea
            id="sched-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <Button type="button" onClick={addItem} disabled={saving}>
        {saving ? 'Adding…' : 'Add schedule item'}
      </Button>
    </div>
  )
}
