'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle, Loader2 } from 'lucide-react'
import type { Profile, Role, VendorPassport } from '@/types/database'
import { buildMinimalPassportSavePayload, formatSupabaseError } from '@/lib/vendor/passport-payload'
import { displayNameLabel, passportDescription, passportTitle } from '@/lib/passport/requirements'

interface PassportProfileFormProps {
  profile: Profile
  existing: VendorPassport | null
}

export function PassportProfileForm({ profile, existing }: PassportProfileFormProps) {
  const role = profile.role as Role
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [displayName, setDisplayName] = useState(
    existing?.business_name?.trim() || profile.full_name?.trim() || ''
  )
  const [bio, setBio] = useState(existing?.bio ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!displayName.trim()) {
      toast.error(`${displayNameLabel(role)} is required`)
      return
    }

    setLoading(true)
    try {
      const payload = buildMinimalPassportSavePayload({
        userId: profile.id,
        displayName,
        bio,
      })

      const { error } = existing
        ? await supabase.from('vendor_passports').update(payload).eq('id', existing.id)
        : await supabase.from('vendor_passports').insert(payload)

      if (error) {
        throw new Error(formatSupabaseError(error))
      }

      toast.success('Passport saved')
      router.push('/profile')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save passport'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to profile
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-gray-900">{passportTitle(role)}</h1>
        <p className="mt-1.5 text-gray-500">{passportDescription(role)}</p>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>
            {role === 'shopper'
              ? 'Name and optional bio. Manage phone and contact sharing on your profile.'
              : 'Name and optional bio. Add your phone on your profile for SMS alerts.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="display-name">{displayNameLabel(role)} *</Label>
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={role === 'vendor' ? 'Sweet Petal Candles' : 'Jane Smith'}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={
                  role === 'coordinator'
                    ? 'Tell vendors and patrons about your markets…'
                    : 'A short note about you (optional)…'
                }
                rows={4}
                maxLength={500}
              />
              <p className="text-right text-xs text-gray-400">{bio.length}/500</p>
            </div>

            <div className="rounded-xl border border-sage-200 bg-sage-50/50 p-4 text-sm text-gray-600">
              {role === 'shopper' ? (
                <>
                  Phone and auction contact preferences live on your{' '}
                  <Link href="/profile" className="font-medium text-forest underline">
                    profile settings
                  </Link>
                  .
                </>
              ) : (
                <>
                  Add your phone for SMS alerts on your{' '}
                  <Link href="/profile" className="font-medium text-forest underline">
                    profile settings
                  </Link>
                  .
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-white"
                disabled={loading || !displayName.trim()}
              >
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
