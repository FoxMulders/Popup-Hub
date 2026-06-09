'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PassportSocialState } from '@/hooks/use-passport-profile'

interface PassportSocialFieldsProps {
  value: PassportSocialState
  onChange: (key: keyof PassportSocialState, value: string) => void
  idPrefix?: string
}

export function PassportSocialFields({
  value,
  onChange,
  idPrefix = 'passport-social',
}: PassportSocialFieldsProps) {
  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50/40 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Social & web</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Shown as clickable icons on your public passport card.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-instagram`}>Instagram</Label>
          <Input
            id={`${idPrefix}-instagram`}
            type="url"
            inputMode="url"
            placeholder="https://instagram.com/yourbrand"
            value={value.instagram}
            onChange={(e) => onChange('instagram', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-tiktok`}>TikTok</Label>
          <Input
            id={`${idPrefix}-tiktok`}
            type="url"
            inputMode="url"
            placeholder="https://tiktok.com/@yourbrand"
            value={value.tiktok}
            onChange={(e) => onChange('tiktok', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-facebook`}>Facebook</Label>
          <Input
            id={`${idPrefix}-facebook`}
            type="url"
            inputMode="url"
            placeholder="https://facebook.com/yourbrand"
            value={value.facebook}
            onChange={(e) => onChange('facebook', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-website`}>Website</Label>
          <Input
            id={`${idPrefix}-website`}
            type="url"
            inputMode="url"
            placeholder="https://yourbusiness.com"
            value={value.website}
            onChange={(e) => onChange('website', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
