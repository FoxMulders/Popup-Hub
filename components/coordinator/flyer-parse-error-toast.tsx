'use client'

import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const FLYER_PARSE_ERROR_TOAST_CLASS =
  'flex flex-row items-center gap-3 p-4 bg-rose-950/90 text-rose-200 border border-rose-800 rounded-lg shadow-xl backdrop-blur-sm max-w-sm'

interface FlyerParseErrorToastProps {
  message: string
  toastId: string | number
}

function FlyerParseErrorToast({ message, toastId }: FlyerParseErrorToastProps) {
  return (
    <div className={FLYER_PARSE_ERROR_TOAST_CLASS} role="alert">
      <p className="min-w-0 flex-1 text-sm leading-snug">{message}</p>
      <button
        type="button"
        onClick={() => toast.dismiss(toastId)}
        className={cn(
          'shrink-0 rounded p-0.5 text-xs leading-none text-rose-300/90',
          'transition-colors hover:bg-rose-800/60 hover:text-rose-50',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/70'
        )}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  )
}

/** Rose-themed flyer parse fallback toast — auto-dismisses after 5s with manual close. */
export function showFlyerParseErrorToast(message: string) {
  return toast.custom((t) => <FlyerParseErrorToast message={message} toastId={t} />, {
    duration: 5000,
    unstyled: true,
  })
}
