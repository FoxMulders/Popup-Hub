export const AVATAR_CHANGED = 'popup-hub:avatar-changed'
export const AVATAR_BROADCAST = 'popup-hub-avatar'

export function dispatchAvatarChanged(userId: string) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(AVATAR_CHANGED, { detail: { userId } }))

  try {
    const channel = new BroadcastChannel(AVATAR_BROADCAST)
    channel.postMessage({ userId })
    channel.close()
  } catch {
    // BroadcastChannel unavailable in some embedded contexts
  }
}
