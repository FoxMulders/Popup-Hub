'use client'

import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AvatarPicker } from '@/components/profile/avatar-picker'
import { toast } from 'sonner'
import { ArrowRight, IdCard, Loader2, User } from 'lucide-react'
import type { Profile } from '@/types/database'
import { PASSPORT_PATH } from '@/lib/passport/requirements'

interface ProfileFormProps {
  profile: Profile
  passportComplete?: boolean
}

export function ProfileForm({ profile, passportComplete = true }: ProfileFormProps) {
  const supabase = createClient()
  const [fullName, setFullName] = useState(profile.full_name ?? '')
  const [phone, setPhone] = useState(profile.phone ?? '')
  const [shareContact, setShareContact] = useState(profile.share_contact_with_vendors ?? false)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url)
  const [loading, setLoading] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        phone: phone || null,
        share_contact_with_vendors: shareContact,
      })
      .eq('id', profile.id)

    setLoading(false)

    if (error) {
      toast.error('Failed to save profile')
    } else {
      toast.success('Profile updated successfully')
    }
  }

  return (
    <form onSubmit={handleSave} className="rounded-2xl border bg-white p-8 space-y-8">
      <AvatarPicker
        profile={{ ...profile, avatar_url: avatarUrl }}
        onAvatarChange={setAvatarUrl}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="full_name" className="text-sm font-medium">
            Full Name
          </Label>
          <Input
            id="full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email" className="text-sm font-medium">
            Email Address
          </Label>
          <Input
            id="email"
            value={profile.email}
            disabled
            className="h-11 bg-canvas text-muted-foreground"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone" className="text-sm font-medium">
            Phone Number
            <span className="ml-2 text-xs text-muted-foreground font-normal">(optional — for SMS alerts)</span>
          </Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
            className="h-11 max-w-[16rem]"
          />
        </div>
      </div>

      <div className="rounded-xl border border-sage-200 bg-sage-50/50 p-4 space-y-2">
        <label htmlFor="share-contact" className="flex items-start gap-3 cursor-pointer">
          <input
            id="share-contact"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300"
            checked={shareContact}
            onChange={(e) => setShareContact(e.target.checked)}
          />
          <span>
            <span className="text-sm font-medium text-foreground">
              Share contact info with vendors (Quarter Auctions only)
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              When enabled, donating vendors can see your name, email, and phone after you win a quarter auction item.
            </span>
          </span>
        </label>
      </div>

      {!passportComplete ? (
        <div className="rounded-xl border border-harvest-200 bg-harvest-50/70 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-harvest-800">Complete your passport</p>
            <p className="text-xs text-harvest-700 mt-0.5">
              Add the details required for your {profile.role} account.
            </p>
          </div>
          <Link href={PASSPORT_PATH}>
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
