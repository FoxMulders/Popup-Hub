'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/profile/user-avatar'
import { cropImageToSquare } from '@/lib/profile/crop-image'
import { fitImageInSquare } from '@/lib/profile/fit-image-square'
import { dispatchAvatarChanged } from '@/lib/profile/avatar-sync'
import type { Profile } from '@/types/database'
import { toast } from '@/lib/toast'
import { Loader2, Trash2, Upload } from 'lucide-react'

interface AvatarPickerProps {
  profile: Profile
  onAvatarChange?: (avatarUrl: string | null) => void
}

export function AvatarPicker({ profile, onAvatarChange }: AvatarPickerProps) {
  const supabase = createClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(false)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be 2MB or smaller')
      return
    }

    setUploading(true)
    try {
      const cropped =
        profile.role === 'vendor' ? await fitImageInSquare(file) : await cropImageToSquare(file)
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `${profile.id}/avatar-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, cropped, {
          upsert: true,
          contentType: cropped.type,
        })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = data.publicUrl

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', profile.id)

      if (profileError) throw profileError

      onAvatarChange?.(avatarUrl)
      dispatchAvatarChanged(profile.id)
      toast.success('Profile photo updated')
    } catch {
      toast.error('Could not upload profile photo')
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    setRemoving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', profile.id)

      if (error) throw error

      onAvatarChange?.(null)
      dispatchAvatarChanged(profile.id)
      toast.success(
        profile.role === 'vendor'
          ? 'Custom photo removed — using passport logo'
          : 'Profile photo removed'
      )
    } catch {
      toast.error('Could not remove profile photo')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <UserAvatar
        userId={profile.id}
        profile={{
          role: profile.role,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        }}
        className="h-24 w-24 sm:h-28 sm:w-28"
        fallbackClassName="text-2xl text-harvest-700 bg-harvest-100"
      />

      <div className="space-y-2">
        <p className="font-semibold text-foreground text-lg">{profile.full_name || 'Your Name'}</p>
        <p className="text-muted-foreground text-sm">{profile.email}</p>
        {profile.role === 'vendor' && !profile.avatar_url ? (
          <p className="text-xs text-muted-foreground">
            No custom photo yet — your passport business logo is shown by default.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading || removing}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Upload photo
          </Button>
          {profile.avatar_url ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading || removing}
              onClick={() => void handleRemove()}
            >
              {removing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Remove
            </Button>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG, or WebP · max 2MB ·{' '}
          {profile.role === 'vendor'
            ? 'your full logo is preserved (letterboxed in a square)'
            : 'auto-cropped to square'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />
      </div>
    </div>
  )
}
