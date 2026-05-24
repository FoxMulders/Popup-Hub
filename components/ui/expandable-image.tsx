'use client'

import { useState } from 'react'
import { Expand } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface ExpandableImageProps {
  src: string
  alt: string
  className?: string
  containerClassName?: string
  /** Prevents parent links from navigating when the image is tapped. */
  stopClickPropagation?: boolean
}

export function ExpandableImage({
  src,
  alt,
  className,
  containerClassName,
  stopClickPropagation = false,
}: ExpandableImageProps) {
  const [open, setOpen] = useState(false)

  function handleOpen(event: React.MouseEvent | React.KeyboardEvent) {
    if (stopClickPropagation && 'stopPropagation' in event) {
      event.preventDefault()
      event.stopPropagation()
    }
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={cn(
          'group/img relative block w-full cursor-zoom-in text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harvest-500 focus-visible:ring-offset-2',
          containerClassName,
        )}
        aria-label={`View full size: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
        <span
          className="pointer-events-none absolute inset-0 flex items-end justify-end p-2 opacity-100 transition sm:opacity-0 sm:group-hover/img:opacity-100 sm:group-focus-visible/img:opacity-100"
          aria-hidden
        >
          <span className="inline-flex items-center gap-1 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
            <Expand className="h-3 w-3" />
            Tap to expand
          </span>
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-h-[96vh] max-w-[96vw] border-0 bg-black/95 p-2 shadow-2xl ring-0 sm:max-w-[96vw] [&_[data-slot=dialog-close]]:text-white [&_[data-slot=dialog-close]:hover]:bg-white/10"
          showCloseButton
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="mx-auto max-h-[calc(96vh-3rem)] w-full object-contain"
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
