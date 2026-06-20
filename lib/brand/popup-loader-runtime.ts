import {
  POPUP_LOADER,
  type LottieAnimationItem,
  type LottiePlayer,
} from '@/lib/brand/popup-loader-config'
import { resolveBrandLogoPath } from '@/lib/brand/brand-logo-paths'

type LottieAsset = {
  id?: string
  p?: string
  u?: string
  w?: number
  h?: number
  e?: number
}

type LottieMarker = {
  cm?: string
  tm?: number
}

type LottieDocument = {
  fr?: number
  ip?: number
  op?: number
  assets?: LottieAsset[]
  markers?: LottieMarker[]
}

let lottieScriptPromise: Promise<LottiePlayer> | null = null

export function loadLottiePlayer(): Promise<LottiePlayer> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Lottie can only load in the browser'))
  }

  if (window.lottie) {
    return Promise.resolve(window.lottie)
  }

  if (!lottieScriptPromise) {
    lottieScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(
        'script[data-popup-lottie="true"]',
      )
      if (existing) {
        if (window.lottie) {
          resolve(window.lottie)
          return
        }
        existing.addEventListener('load', () => {
          if (window.lottie) resolve(window.lottie)
          else reject(new Error('Lottie failed to initialize'))
        })
        existing.addEventListener('error', () => reject(new Error('Lottie script error')))
        return
      }

      const script = document.createElement('script')
      script.src = POPUP_LOADER.lottieCdn
      script.async = true
      script.dataset.popupLottie = 'true'
      script.onload = () => {
        if (window.lottie) resolve(window.lottie)
        else reject(new Error('Lottie failed to initialize'))
      }
      script.onerror = () => reject(new Error('Failed to load Lottie CDN script'))
      document.head.appendChild(script)
    })
  }

  return lottieScriptPromise
}

export function patchLoaderLogoAssets(
  animationData: LottieDocument,
  logoPath: string = POPUP_LOADER.logoPath,
): LottieDocument {
  const cloned = structuredClone(animationData)
  const fileName = logoPath.split('/').pop() ?? 'popup-hub-logo.png'
  const basePath = logoPath.slice(0, logoPath.lastIndexOf('/') + 1) || '/'

  for (const asset of cloned.assets ?? []) {
    if (!asset.p) continue
    const matchesPlaceholder = POPUP_LOADER.logoAssetNames.some(
      (name) => asset.p?.toLowerCase() === name.toLowerCase(),
    )
    if (matchesPlaceholder || /logo/i.test(asset.p)) {
      asset.p = fileName
      asset.u = basePath
      asset.e = 0
    }
  }

  return cloned
}

export function resolveHoldFrame(animationData: LottieDocument): number {
  const marker = (animationData.markers ?? []).find((entry) =>
    POPUP_LOADER.holdMarkerNames.some(
      (name) => entry.cm?.toLowerCase() === name.toLowerCase(),
    ),
  )

  const totalFrames = Math.max(1, (animationData.op ?? 0) - (animationData.ip ?? 0))
  const candidate = marker?.tm ?? POPUP_LOADER.holdFrameFallback
  return Math.min(Math.max(0, candidate), Math.max(0, totalFrames - 2))
}

export async function fetchLoaderAnimation(): Promise<LottieDocument> {
  const response = await fetch(POPUP_LOADER.animationPath, { cache: 'force-cache' })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${POPUP_LOADER.animationPath}`)
  }
  const json = (await response.json()) as LottieDocument
  return patchLoaderLogoAssets(json, resolveBrandLogoPath())
}

export type LoaderController = {
  destroy: () => void
}

export function createLoaderController({
  container,
  animationData,
  onReadyToDismiss,
}: {
  container: HTMLElement
  animationData: LottieDocument
  onReadyToDismiss: () => void
}): LoaderController {
  let destroyed = false
  let pageLoaded = document.readyState === 'complete'
  let animationComplete = false
  let pausedForLoad = false
  let animation: LottieAnimationItem | null = null
  let holdFrame = resolveHoldFrame(animationData)
  let maxWaitTimer: number | null = null

  const onEnterFrame = () => {
    if (!animation || pageLoaded || pausedForLoad) return
    if (animation.currentFrame >= holdFrame - 0.5) {
      animation.goToAndStop(holdFrame, true)
      pausedForLoad = true
    }
  }

  const onComplete = () => {
    animationComplete = true
    maybeDismiss()
  }

  const onWindowLoad = () => {
    pageLoaded = true
    if (animation && pausedForLoad) {
      pausedForLoad = false
      animation.goToAndPlay(holdFrame, true)
    }
    maybeDismiss()
  }

  function maybeDismiss() {
    if (destroyed) return
    if (pageLoaded && animationComplete) {
      onReadyToDismiss()
    }
  }

  void loadLottiePlayer().then((lottie) => {
    if (destroyed) return

    animation = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: false,
      autoplay: true,
      animationData,
    })

    holdFrame = resolveHoldFrame(animationData)
    animation.addEventListener('enterFrame', onEnterFrame)
    animation.addEventListener('complete', onComplete)

    if (pageLoaded) {
      onWindowLoad()
    } else {
      window.addEventListener('load', onWindowLoad, { once: true })
    }

    maxWaitTimer = window.setTimeout(() => {
      pageLoaded = true
      animationComplete = true
      maybeDismiss()
    }, POPUP_LOADER.maxWaitMs)
  })

  return {
    destroy: () => {
      destroyed = true
      window.removeEventListener('load', onWindowLoad)
      if (maxWaitTimer != null) window.clearTimeout(maxWaitTimer)
      animation?.removeEventListener('enterFrame', onEnterFrame)
      animation?.removeEventListener('complete', onComplete)
      animation?.destroy()
      animation = null
    },
  }
}
