'use client'

import { useCallback, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import type { Role, VendorPassport } from '@/types/database'
import { normalizeUrl, normalizeTikTokUrl } from '@/lib/vendor/normalize-url'
import {
  buildMinimalPassportSavePayload,
  buildPassportSavePayload,
  formatSupabaseError,
} from '@/lib/vendor/passport-payload'

export type PassportSocialState = {
  website: string
  instagram: string
  tiktok: string
  facebook: string
}

export type PassportProfileState = {
  displayName: string
  bio: string
  social: PassportSocialState
  primaryCategoryId: string
  requiresElectricity: boolean
}

function initialSocial(existing: VendorPassport | null): PassportSocialState {
  return {
    website: existing?.website_url ?? '',
    instagram: existing?.instagram_url ?? '',
    tiktok: existing?.tiktok_url ?? '',
    facebook: existing?.facebook_url ?? '',
  }
}

export function usePassportProfile(
  userId: string,
  role: Role,
  existing: VendorPassport | null,
  profileFallbackName?: string
) {
  const supabase = createClient()
  const [state, setState] = useState<PassportProfileState>({
    displayName:
      existing?.business_name?.trim() || profileFallbackName?.trim() || '',
    bio: existing?.bio ?? '',
    social: initialSocial(existing),
    primaryCategoryId: existing?.primary_category_id ?? '',
    requiresElectricity: existing?.requires_electricity ?? false,
  })
  const [loading, setLoading] = useState(false)

  const updateField = useCallback(
    <K extends keyof Omit<PassportProfileState, 'social'>>(
      key: K,
      value: PassportProfileState[K]
    ) => {
      setState((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const updateSocial = useCallback(
    (key: keyof PassportSocialState, value: string) => {
      setState((prev) => ({
        ...prev,
        social: { ...prev.social, [key]: value },
      }))
    },
    []
  )

  const saveMinimal = useCallback(async () => {
    if (!state.displayName.trim()) {
      toast.error('Display name is required')
      return false
    }

    setLoading(true)
    try {
      const payload = {
        ...buildMinimalPassportSavePayload({
          userId,
          displayName: state.displayName,
          bio: state.bio,
        }),
        website_url: normalizeUrl(state.social.website),
        instagram_url: normalizeUrl(state.social.instagram),
        tiktok_url: normalizeTikTokUrl(state.social.tiktok),
        facebook_url: normalizeUrl(state.social.facebook),
      }

      const { error } = existing
        ? await supabase.from('vendor_passports').update(payload).eq('id', existing.id)
        : await supabase.from('vendor_passports').insert(payload)

      if (error) throw new Error(formatSupabaseError(error))

      toast.success('Passport saved')
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save passport'
      toast.error(message)
      return false
    } finally {
      setLoading(false)
    }
  }, [existing, state, supabase, userId])

  const saveVendorLogistics = useCallback(
    async () => {
      if (!state.displayName.trim()) {
        toast.error('Business name is required')
        return false
      }
      if (!state.primaryCategoryId) {
        toast.error('Product category is required')
        return false
      }

      setLoading(true)
      try {
        const payload = buildPassportSavePayload({
          userId,
          businessName: state.displayName,
          bio: state.bio,
          primaryCategoryId: state.primaryCategoryId,
          categoryIds: [state.primaryCategoryId],
          logoUrl: existing?.logo_url ?? null,
          itemImageUrls: existing?.item_image_urls ?? [],
          taxIdEncrypted: existing?.tax_id_encrypted ?? null,
          websiteUrl: normalizeUrl(state.social.website),
          shopUrl: existing?.shop_url ?? null,
          instagramUrl: normalizeUrl(state.social.instagram),
          tiktokUrl: normalizeTikTokUrl(state.social.tiktok),
          businessNumber: existing?.business_number ?? null,
          socialHandle: existing?.social_handle ?? null,
          verificationStatus: existing?.verification_status,
          riskScore: existing?.risk_score,
        })

        const logisticsPayload = {
          ...payload,
          facebook_url: normalizeUrl(state.social.facebook),
          requires_electricity: state.requiresElectricity,
        }

        const { error } = existing
          ? await supabase
              .from('vendor_passports')
              .update(logisticsPayload)
              .eq('id', existing.id)
          : await supabase.from('vendor_passports').insert(logisticsPayload)

        if (error) throw new Error(formatSupabaseError(error))

        toast.success('Passport updated')
        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save passport'
        toast.error(message)
        return false
      } finally {
        setLoading(false)
      }
    },
    [existing, state, supabase, userId]
  )

  return {
    state,
    loading,
    updateField,
    updateSocial,
    saveMinimal,
    saveVendorLogistics,
    isVendor: role === 'vendor',
  }
}
