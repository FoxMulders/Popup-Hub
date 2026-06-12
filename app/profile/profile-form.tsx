'use client'

import Link from 'next/link'
import { useProfileSettings } from '@/hooks/use-profile-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowRight, IdCard, Loader2, User } from 'lucide-react'
import type { Profile } from '@/types/database'
import { passportPathForProfile } from '@/lib/passport/requirements'

interface ProfileFormProps {
  profile: Profile
  passportComplete?: boolean
}

export function ProfileForm({ profile, passportComplete = true }: ProfileFormProps) {
  const { state, loading, updateField, save } = useProfileSettings(profile)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    await save()
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border bg-white p-8 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Private account details</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Legal identity and contact used for sign-in and automated alerts only.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="legal_name" className="text-sm font-medium">
            Legal Name
          </Label>
          <Input
            id="legal_name"
            value={state.legalName}
            onChange={(e) => updateField('legalName', e.target.value)}
            placeholder="Jane Smith"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Private Email
          </Label>
          <Input
            id="email"
            value={profile.email}
            disabled
            className="h-11 bg-canvas text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Phone Number
          </Label>
          <p className="text-xs text-muted-foreground -mt-1">
            Private — Used only for automated system SMS alerts.
          </p>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={state.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="h-11 max-w-[16rem]"
          />
        </div>
      </div>

      {profile.role === 'shopper' ? (
        <div className="rounded-xl border border-sage-200 bg-sage-50/50 p-4">
          <label htmlFor="share-contact" className="flex items-start gap-3 cursor-pointer">
            <input
              id="share-contact"
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300"
              checked={state.shareContactWithVendors}
              onChange={(e) => updateField('shareContactWithVendors', e.target.checked)}
            />
            <span>
              <span className="text-sm font-medium text-foreground">
                Share contact info with vendors (Quarter Auctions only)
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">
                When enabled, donating vendors can see your name, email, and phone after you win a
                quarter auction item.
              </span>
            </span>
          </label>
        </div>
      ) : null}

      {!passportComplete ? (
        <div className="rounded-xl border border-harvest-200 bg-harvest-50/70 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-harvest-800">Complete your passport</p>
            <p className="text-xs text-harvest-700 mt-0.5">
              Public brand details live on your passport, not here.
            </p>
          </div>
          <Link href={passportPathForProfile(profile)}>
            <Button variant="outline" size="sm" className="gap-1.5 border-harvest-400 bg-white">
              <IdCard className="h-4 w-4" />
              Open passport
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      ) : null}

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" disabled={loading} className="h-11 px-8">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <User className="mr-2 h-4 w-4" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
