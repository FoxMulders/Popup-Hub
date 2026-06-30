import { toast as sonnerToast, type ExternalToast } from 'sonner'
import type { ReactNode } from 'react'

/** Error toasts stay visible until the user dismisses them. */
function error(message: ReactNode, data?: ExternalToast) {
  return sonnerToast.error(message, { ...data, duration: Infinity })
}

export const toast = Object.assign(sonnerToast, { error })

export type { ExternalToast } from 'sonner'
