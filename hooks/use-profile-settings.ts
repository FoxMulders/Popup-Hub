'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Profile } from '@/types/database'

export type ProfileSettingsState = {
  legalName: string
  phone: string
  shareContactWithVendors: boolean
  preferredName: string
  city: string
  province: string
  bioShort: string
}

export function useProfileSettings(profile: Profile) {
  const supabase = createClient()
  const [state, setState] = useState<ProfileSettingsState>({
    legalName: profile.full_name ?? '',
    phone: profile.phone ?? '',
    shareContactWithVendors: profile.share_contact_with_vendors ?? false,
    preferredName: profile.preferred_name ?? '',
    city: profile.city ?? '',
    province: profile.province ?? '',
    bioShort: profile.bio_short ?? '',
  })
  const [loading, setLoading] = useState(false)

  const updateField = useCallback(
    <K extends keyof ProfileSettingsState>(key: K, value: ProfileSettingsState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const save = useCallback(async () => {
    setLoading(true)

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: state.legalName.trim(),
        phone: state.phone.trim() || null,
        share_contact_with_vendors: state.shareContactWithVendors,
        preferred_name: state.preferredName.trim() || null,
        city: state.city.trim() || null,
        province: state.province.trim() || null,
        bio_short: state.bioShort.trim() || null,
      })
      .eq('id', profile.id)

    setLoading(false)

    if (error) {
      toast.error('Failed to save profile settings')
      return false
    }

    toast.success('Profile settings saved')
    return true
  }, [profile.id, state, supabase])

  return {
    state,
    loading,
    updateField,
    save,
  }
}
