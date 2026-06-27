/** Square Location Tent storefront icon — vector mark for crisp UI rendering. */
export const BRAND_LOGO = {
  width: 994,
  height: 994,
  light: '/popup-hub-mark.svg',
  dark: '/popup-hub-mark.svg',
} as const

export function brandLogoVersion() {
  return (
    process.env.NEXT_PUBLIC_BUILD_NUMBER ??
    process.env.NEXT_PUBLIC_GIT_HASH ??
    process.env.NEXT_PUBLIC_BUILD_COMMIT ??
    '1'
  )
}

export function brandLogoPath(variant: 'light' | 'dark' = 'light') {
  return variant === 'dark' ? BRAND_LOGO.dark : BRAND_LOGO.light
}

export function brandLogoSrc(variant: 'light' | 'dark' = 'light') {
  return `${brandLogoPath(variant)}?v=${brandLogoVersion()}`
}

/** True when the UI should show the dark logo variant. */
export function resolveBrandLogoDark(): boolean {
  if (typeof window === 'undefined') return false
  const root = document.documentElement
  if (root.classList.contains('dark')) return true
  if (root.classList.contains('light')) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveBrandLogoPath(preferDark = resolveBrandLogoDark()) {
  return brandLogoPath(preferDark ? 'dark' : 'light')
}
