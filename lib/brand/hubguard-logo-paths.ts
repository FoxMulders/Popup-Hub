/** HubGuard trust directory brand artwork. */
export const HUBGUARD_LOGO = {
  /** Full lockup — shield emblem + HubGuard wordmark */
  lockup: {
    path: '/hubguard-logo.png',
    width: 640,
    height: 634,
  },
  /** Shield + stall + pin — no wordmark */
  icon: {
    path: '/hubguard-icon.png',
    width: 512,
    height: 512,
  },
} as const

export function hubguardLogoVersion() {
  return (
    process.env.NEXT_PUBLIC_BUILD_NUMBER ??
    process.env.NEXT_PUBLIC_GIT_HASH ??
    process.env.NEXT_PUBLIC_BUILD_COMMIT ??
    '1'
  )
}

export function hubguardLogoSrc(variant: 'lockup' | 'icon' = 'lockup') {
  const base =
    variant === 'icon' ? HUBGUARD_LOGO.icon.path : HUBGUARD_LOGO.lockup.path
  return `${base}?v=${hubguardLogoVersion()}`
}
