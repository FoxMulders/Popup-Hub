/** PopupFunds branding — digital wallet product name. */

export const POPUP_FUNDS_LOGO = {
  src: '/popup-funds-logo.png',
  width: 512,
  height: 640,
} as const

export const POPUP_FUNDS_WORDMARK = {
  src: '/popup-funds-wordmark.png',
  width: 1200,
  height: 280,
} as const

export function popupFundsWordmarkSrc(): string {
  return POPUP_FUNDS_WORDMARK.src
}

export function popupFundsLogoSrc(): string {
  return POPUP_FUNDS_LOGO.src
}
