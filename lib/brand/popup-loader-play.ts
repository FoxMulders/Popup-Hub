/** Dispatches a global event to play a random market loader (logo easter egg). */
export const POPUP_LOADER_PLAY_EVENT = 'popup-hub:play-loader'

type PlayLoaderFn = () => void

let playLoaderFn: PlayLoaderFn | null = null

/** Registered by PopupLoaderProvider — more reliable than events alone. */
export function setPopupLoaderPlayHandler(handler: PlayLoaderFn | null) {
  playLoaderFn = handler
}

export function requestPopupLoaderAnimation() {
  if (typeof window === 'undefined') return

  if (playLoaderFn) {
    playLoaderFn()
    return
  }

  window.dispatchEvent(new CustomEvent(POPUP_LOADER_PLAY_EVENT, { bubbles: true }))
}
