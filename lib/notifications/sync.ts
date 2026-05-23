export const NOTIFICATIONS_CHANGED = 'popup-hub:notifications-changed'

export function dispatchNotificationsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED))
  }
}
