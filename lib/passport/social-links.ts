import { Camera, Globe } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { FacebookIcon } from '@/components/icons/facebook-icon'
import { TikTokIcon } from '@/components/icons/tiktok-icon'

export type PassportSocialField =
  | 'website_url'
  | 'instagram_url'
  | 'tiktok_url'
  | 'facebook_url'
  | 'shop_url'

export type PassportSocialIcon = LucideIcon | typeof FacebookIcon | typeof TikTokIcon

export type PassportSocialLink = {
  field: PassportSocialField
  label: string
  url: string
  Icon: PassportSocialIcon
}

const SOCIAL_ICON_MAP = {
  website_url: Globe,
  instagram_url: Camera,
  tiktok_url: TikTokIcon,
  facebook_url: FacebookIcon,
  shop_url: Globe,
} as const

export type PassportSocialSource = {
  website_url?: string | null
  instagram_url?: string | null
  tiktok_url?: string | null
  facebook_url?: string | null
  shop_url?: string | null
}

/** Primary social blocks for public passport cards (Instagram, Facebook, Website). */
export function getPassportSocialLinks(
  source: PassportSocialSource | null | undefined,
  options?: { includeShop?: boolean }
): PassportSocialLink[] {
  if (!source) return []

  const links: PassportSocialLink[] = []
  const add = (field: PassportSocialField, label: string, url: string | null | undefined) => {
    const trimmed = url?.trim()
    if (!trimmed) return
    links.push({
      field,
      label,
      url: trimmed,
      Icon: SOCIAL_ICON_MAP[field],
    })
  }

  add('instagram_url', 'Instagram', source.instagram_url)
  add('tiktok_url', 'TikTok', source.tiktok_url)
  add('facebook_url', 'Facebook', source.facebook_url)
  add('website_url', 'Website', source.website_url)

  if (options?.includeShop) {
    add('shop_url', 'Shop', source.shop_url)
  }

  return links
}
