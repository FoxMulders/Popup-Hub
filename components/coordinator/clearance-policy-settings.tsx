'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { HelpCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { CLEARANCE_POLICY_OPTIONS } from '@/lib/booth-clearance-policy'
import type { BoothClearancePolicy } from '@/types/database'

interface ClearancePolicySettingsProps {
  eventId: string
  initialPolicy: BoothClearancePolicy
  onPolicyChange?: (policy: BoothClearancePolicy) => void
}

export function ClearancePolicySettings({
  eventId,
  initialPolicy,
  onPolicyChange,
}: ClearancePolicySettingsProps) {
  const supabase = createClient()
  const [policy, setPolicy] = useState<BoothClearancePolicy>(initialPolicy)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selected = CLEARANCE_POLICY_OPTIONS.find((o) => o.value === policy)

  async function handleChange(value: BoothClearancePolicy) {
    setPolicy(value)
    setSaving(true)
    setSaved(false)
    const { error } = await supabase
      .from('events')
      .update({ booth_clearance_policy: value })
      .eq('id', eventId)
    setSaving(false)
    if (error) {
      toast.error('Failed to update clearance policy')
      setPolicy(initialPolicy)
      return
    }
    setSaved(true)
    onPolicyChange?.(value)
    toast.success('Booth clearance policy updated')
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-1.5">
        <Label htmlFor="clearance-policy" className="text-sm font-semibold text-foreground">
          Booth clearance policy
        </Label>
        <Tooltip>
          <TooltipTrigger type="button">
            <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            Controls whether vendors need photo proof at teardown, and whether venue tables and chairs must stay or be packed away.
          </TooltipContent>
        </Tooltip>
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-harvest-500 ml-auto" />}
        {saved && !saving && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 ml-auto" />}
      </div>

      <Select value={policy} onValueChange={(v) => v && handleChange(v as BoothClearancePolicy)}>
        <SelectTrigger id="clearance-policy">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CLEARANCE_POLICY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <p className="text-xs text-muted-foreground leading-relaxed">{selected.description}</p>
      )}
    </div>
  )
}
