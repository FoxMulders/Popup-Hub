'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Expand } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FeedbackScreenshotPreviewProps {
  url: string
  title: string
}

export function FeedbackScreenshotPreview({ url, title }: FeedbackScreenshotPreviewProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative w-full overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest"
      >
        <div className="relative aspect-video w-full">
          <Image
            src={url}
            alt={`Screenshot for ${title}`}
            fill
            unoptimized
            className="object-contain bg-stone-50"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2.5 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
              <Expand className="size-3.5" aria-hidden />
              View full screen
            </span>
          </span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[95dvh] max-w-[min(96vw,1200px)] overflow-hidden p-2 sm:p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>Screenshot — {title}</DialogTitle>
            <DialogDescription>Full-size screenshot attachment</DialogDescription>
          </DialogHeader>
          <div className="relative max-h-[calc(95dvh-2rem)] w-full overflow-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Screenshot for ${title}`}
              className="mx-auto max-h-[calc(95dvh-2.5rem)] w-auto max-w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
