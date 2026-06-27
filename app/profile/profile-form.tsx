'use client'

import Link from 'next/link'
import { useProfileSettings } from '@/hooks/use-profile-settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
    <form onSubmit={handleSave} className="rounded-2xl border bg-white p-4 space-y-6 sm:p-8">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Private account details</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Legal identity and contact used for sign-in and automated alerts only. All fields below are
          optional except where required for your role.
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
          <Label htmlFor="preferred_name" className="text-sm font-medium">
            Preferred name <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="preferred_name"
            value={state.preferredName}
            onChange={(e) => updateField('preferredName', e.target.value)}
            placeholder="What we call you in emails"
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
          <p className="text-xs text-muted-foreground">
            Change your email under Account Security below.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Phone Number <span className="font-normal text-muted-foreground">(optional)</span>
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
            className="h-11 max-w-full md:max-w-[16rem]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city" className="text-sm font-medium">
            City <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="city"
            value={state.city}
            onChange={(e) => updateField('city', e.target.value)}
            placeholder="Edmonton"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="province" className="text-sm font-medium">
            Province <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="province"
            value={state.province}
            onChange={(e) => updateField('province', e.target.value)}
            placeholder="AB"
            className="h-11"
          />
        </div>

        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="bio_short" className="text-sm font-medium">
            Private note <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="bio_short"
            rows={3}
            value={state.bioShort}
            onChange={(e) => updateField('bioShort', e.target.value)}
            placeholder="Anything helpful for support — never shown on your public passport."
            className="resize-y"
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
                Share contact info with vendors
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

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] z-10 -mx-4 flex items-center gap-4 border-t border-stone-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:pt-2 md:bottom-auto">
        <Button type="submit" disabled={loading} className="h-11 w-full px-8 sm:w-auto">
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
