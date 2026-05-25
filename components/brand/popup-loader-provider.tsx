'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { POPUP_LOADER } from '@/lib/brand/popup-loader-config'
import {
  POPUP_LOADER_PLAY_EVENT,
  setPopupLoaderPlayHandler,
} from '@/lib/brand/popup-loader-play'
import { PopupLoaderContext } from '@/components/brand/popup-loader-context'
import { PopupLoaderScene } from '@/components/brand/popup-loader-scene'
import {
  pickRandomLoaderVariant,
  type LoaderControllerMode,
  type LoaderVariantId,
} from '@/lib/brand/loader-variants'

const INITIAL_LOADER_KEY = 'popup-hub-initial-loader-shown'

/** Survives React Strict Mode remounts and sessionStorage failures in private browsing. */
let initialLoaderShownThisTab = false

type LoaderSession = {
  key: number
  variantId: LoaderVariantId
  mode: LoaderControllerMode
}

export function PopupLoaderProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LoaderSession | null>(null)
  const [exiting, setExiting] = useState(false)

  const dismiss = useCallback(() => {
    setExiting(true)
    window.setTimeout(() => {
      document.body.style.overflow = 'auto'
      document.body.classList.remove('loader-active')
      setSession(null)
      setExiting(false)
    }, POPUP_LOADER.fadeOutMs)
  }, [])

  const playRandomLoader = useCallback(() => {
    if (typeof window === 'undefined') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    setExiting(false)
    setSession({
      key: Date.now(),
      variantId: pickRandomLoaderVariant({ forReplay: true }),
      mode: 'replay',
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) return

    if (initialLoaderShownThisTab) return

    let skipInitial = false
    try {
      skipInitial = sessionStorage.getItem(INITIAL_LOADER_KEY) === '1'
    } catch {
      skipInitial = false
    }

    if (skipInitial) {
      initialLoaderShownThisTab = true
      return
    }

    initialLoaderShownThisTab = true
    try {
      sessionStorage.setItem(INITIAL_LOADER_KEY, '1')
    } catch {
      /* private browsing — in-memory guard above still applies */
    }

    setSession({ key: 0, variantId: 'walk-to-market', mode: 'initial' })
  }, [])

  useEffect(() => {
    setPopupLoaderPlayHandler(playRandomLoader)
    return () => setPopupLoaderPlayHandler(null)
  }, [playRandomLoader])

  useEffect(() => {
    const onPlayRequest = () => playRandomLoader()
    window.addEventListener(POPUP_LOADER_PLAY_EVENT, onPlayRequest)
    return () => window.removeEventListener(POPUP_LOADER_PLAY_EVENT, onPlayRequest)
  }, [playRandomLoader])

  useEffect(() => {
    if (!session) return

    const body = document.body
    const previousOverflow = body.style.overflow
    body.classList.add('loader-active')
    body.style.overflow = 'hidden'

    return () => {
      body.style.overflow = previousOverflow
      body.classList.remove('loader-active')
    }
  }, [session?.key])

  const value = useMemo(() => ({ playRandomLoader }), [playRandomLoader])

  const overlay = session ? (
    <div
      id="loader-screen"
      className={`loader-screen${exiting ? ' loader-screen--exit' : ''}`}
      data-loader-mode={session.mode}
      data-loader-variant={session.variantId}
      aria-hidden={exiting}
      aria-busy={!exiting}
      role="status"
      aria-label="Popup Hub market animation"
    >
      <PopupLoaderScene
        key={session.key}
        variantId={session.variantId}
        mode={session.mode}
        onReadyToDismiss={dismiss}
      />
    </div>
  ) : null

  return (
    <PopupLoaderContext.Provider value={value}>
      {children}
      {overlay && typeof document !== 'undefined'
        ? createPortal(overlay, document.body)
        : null}
    </PopupLoaderContext.Provider>
  )
}
