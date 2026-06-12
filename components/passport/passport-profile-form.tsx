'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { usePassportProfile } from '@/hooks/use-passport-profile'
import { PassportSocialFields } from '@/components/passport/passport-social-fields'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import type { Profile, Role, VendorPassport } from '@/types/database'
import { displayNameLabel, passportDescription, passportTitle } from '@/lib/passport/requirements'

interface PassportProfileFormProps {
  profile: Profile
  existing: VendorPassport | null
}

export function PassportProfileForm({ profile, existing }: PassportProfileFormProps) {
  const role = profile.role as Role
  const router = useRouter()
  const { state, loading, updateField, updateSocial, saveMinimal } = usePassportProfile(
    profile.id,
    role,
    existing,
    profile.full_name
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await saveMinimal()
    if (ok) {
      router.push('/profile')
      router.refresh()
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile settings
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-foreground">{passportTitle(role)}</h1>
        <p className="mt-1.5 text-muted-foreground">{passportDescription(role)}</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Public storefront</CardTitle>
          <CardDescription>
            These details appear on your public passport card. Private account settings stay on
            profile settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="display-name">{displayNameLabel(role)} *</Label>
              <Input
                id="display-name"
                value={state.displayName}
                onChange={(e) => updateField('displayName', e.target.value)}
                placeholder={role === 'vendor' ? 'Sweet Petal Candles' : 'Jane Smith'}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bio">Public Bio</Label>
              <Textarea
                id="bio"
                value={state.bio}
                onChange={(e) => updateField('bio', e.target.value)}
                placeholder={
                  role === 'coordinator'
                    ? 'Tell vendors and patrons about your markets…'
                    : 'A short note about you (optional)…'
                }
                rows={4}
                maxLength={500}
              />
              <p className="text-right text-xs text-muted-foreground">{state.bio.length}/500</p>
            </div>

            <PassportSocialFields
              value={state.social}
              onChange={updateSocial}
              idPrefix={`${role}-passport`}
            />

            <div className="rounded-xl border border-sage-200 bg-sage-50/50 p-4 text-sm text-muted-foreground">
              Phone, email, and password are managed in{' '}
              <Link href="/profile" className="font-medium text-forest underline">
                profile settings
              </Link>
              .
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={loading || !state.displayName.trim()}>
                {loading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Save Passport
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
