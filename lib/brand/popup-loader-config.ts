/** Popup Hub full-screen loader configuration. */
export const POPUP_LOADER = {
  /** Legacy Lottie JSON path (kept for loader-demo.html). Premium loader uses SVG runtime. */
  animationPath: '/popup-loader.json',
  /** Maps placeholder asset filenames inside the Lottie JSON to this logo. */
  logoPath: '/popup-hub-brand.png',
  logoAssetNames: ['logo.png', 'logo', 'Logo.png', 'company-logo.png'],
  /** Marker name in AE export — frame to hold on while the page is still loading. */
  holdMarkerNames: ['pre_door', 'pre-door', 'hold', 'door_closed'],
  /** Fallback hold frame when markers are absent (adjust to match your export). */
  holdFrameFallback: 530,
  fadeOutMs: 600,
  /** Safety timeout so the site never stays blocked. */
  maxWaitMs: 20_000,
  lottieCdn:
    'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js',
} as const

export type LottieAnimationItem = {
  play: () => void
  pause: () => void
  stop: () => void
  destroy: () => void
  goToAndStop: (value: number, isFrame?: boolean) => void
  goToAndPlay: (value: number, isFrame?: boolean) => void
  addEventListener: (name: string, callback: () => void) => void
  removeEventListener: (name: string, callback: () => void) => void
  currentFrame: number
  isPaused: boolean
  totalFrames: number
}

export type LottiePlayer = {
  loadAnimation: (params: {
    container: Element
    renderer: 'svg'
    loop: boolean
    autoplay: boolean
    animationData?: unknown
  }) => LottieAnimationItem
}

declare global {
  interface Window {
    lottie?: LottiePlayer
  }
}
