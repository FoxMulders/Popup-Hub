'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import type { Event, PetPolicy } from '@/types/database'
import { PET_POLICY_LABELS } from '@/lib/shopper/layout'

interface EventLogisticsEditorProps {
  event: Event
}

export function EventLogisticsEditor({ event }: EventLogisticsEditorProps) {
  const router = useRouter()
  const supabase = createClient()
  const [parkingNotes, setParkingNotes] = useState(event.parking_notes ?? '')
  const [wheelchairNotes, setWheelchairNotes] = useState(event.wheelchair_access_notes ?? '')
  const [petPolicy, setPetPolicy] = useState<PetPolicy>(event.pet_policy ?? 'service_animals_only')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    const { error } = await supabase
      .from('events')
      .update({
        parking_notes: parkingNotes.trim() || null,
        wheelchair_access_notes: wheelchairNotes.trim() || null,
        pet_policy: petPolicy,
      })
      .eq('id', event.id)
    setSaving(false)
    if (error) {
      toast.error('Could not save logistics info')
      return
    }
    toast.success('Shopper logistics updated')
    router.refresh()
  }

  return (
    <div className="market-panel space-y-4 p-5">
      <div>
        <h3 className="font-heading font-semibold">Shopper logistics</h3>
        <p className="text-sm text-muted-foreground">
          Parking, accessibility, and pet policy shown on the public market page.
        </p>
      </div>
      <div className="space-y-1">
        <Label htmlFor="parking">Parking notes</Label>
        <Textarea
          id="parking"
          value={parkingNotes}
          onChange={(e) => setParkingNotes(e.target.value)}
          placeholder="e.g. Free lot behind the hall, street parking on 71 Ave…"
          rows={2}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="wheelchair">Wheelchair / mobility access</Label>
        <Textarea
          id="wheelchair"
          value={wheelchairNotes}
          onChange={(e) => setWheelchairNotes(e.target.value)}
          placeholder="e.g. Ramp at main entrance, accessible washrooms…"
          rows={2}
        />
      </div>
      <div className="space-y-1">
        <Label>Pet policy</Label>
        <Select value={petPolicy} onValueChange={(v) => setPetPolicy(v as PetPolicy)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PET_POLICY_LABELS) as PetPolicy[]).map((key) => (
              <SelectItem key={key} value={key}>
                {PET_POLICY_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button type="button" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save logistics'}
      </Button>
    </div>
  )
}
