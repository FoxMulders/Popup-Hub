'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TouchFileInput } from '@/components/ui/touch-file-input'
import { parseFlyerImage, type FlyerExtractedDetails } from '@/lib/shopper/parse-flyer-image'
import type { Event } from '@/types/database'
import { cn } from '@/lib/utils'
import { ExpandableImage } from '@/components/ui/expandable-image'
import { ImageIcon, Loader2, X } from 'lucide-react'

interface DiscoverFlyerUploadProps {
  events: Event[]
  quarterAuctionsOnly: boolean
  onApplyFilters: (updates: {
    date?: Date
    quarterAuctions?: boolean
  }) => void
}

export function DiscoverFlyerUpload({
  events,
  quarterAuctionsOnly,
  onApplyFilters,
}: DiscoverFlyerUploadProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [extracted, setExtracted] = useState<FlyerExtractedDetails | null>(null)
  const [promptDismissed, setPromptDismissed] = useState(false)
  const objectUrlRef = useRef<string | null>(null)

  const revokePreview = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  useEffect(() => () => revokePreview(), [revokePreview])

  function clearUpload() {
    revokePreview()
    setPreviewUrl(null)
    setFileName(null)
    setExtracted(null)
    setPromptDismissed(false)
  }

  async function handleFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return

    revokePreview()
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setPreviewUrl(url)
    setFileName(file.name)
    setPromptDismissed(false)
    setParsing(true)

    try {
      const details = parseFlyerImage(file, events)
      setExtracted(details)
    } finally {
      setParsing(false)
    }
  }

  const hasExtractedDetails =
    extracted &&
    (extracted.eventName ||
      extracted.eventDateLabel ||
      extracted.locationHint ||
      extracted.suggestsQuarterAuction)

  const filtersWouldChange =
    extracted &&
    ((extracted.eventDate && extracted.eventDateLabel) ||
      (extracted.suggestsQuarterAuction && !quarterAuctionsOnly))

  function applySuggestedFilters() {
    if (!extracted) return
    onApplyFilters({
      date: extracted.eventDate ?? undefined,
      quarterAuctions: extracted.suggestsQuarterAuction ? true : undefined,
    })
    setPromptDismissed(true)
  }

  return (
    <section
      className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5"
      aria-label="Upload a market flyer"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground sm:text-lg">
            Have a flyer?
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload a poster photo and we&apos;ll suggest matching discover filters.
          </p>
        </div>
        {previewUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={clearUpload} className="gap-1.5">
            <X className="h-4 w-4" aria-hidden />
            Clear
          </Button>
        ) : null}
      </div>

      {!previewUrl ? (
        <div className="mt-3">
          <TouchFileInput
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleFile}
            disabled={parsing}
            label="Tap to upload a market flyer or poster"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <figure className="overflow-hidden rounded-xl border border-stone-200 bg-canvas">
            <ExpandableImage
              src={previewUrl}
              alt={fileName ? `Uploaded flyer: ${fileName}` : 'Uploaded market flyer'}
              className="mx-auto max-h-[min(60vh,520px)] w-full object-contain"
            />
            {fileName ? (
              <figcaption className="border-t border-stone-200 px-3 py-2 text-xs text-muted-foreground">
                {fileName}
              </figcaption>
            ) : null}
          </figure>

          {parsing ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Reading flyer details…
            </div>
          ) : null}

          {hasExtractedDetails && !parsing ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Extracted details
              </h3>
              <dl className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-stone-50/60">
                {extracted.eventName ? (
                  <div className="px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Event
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{extracted.eventName}</dd>
                  </div>
                ) : null}
                {extracted.eventDateLabel ? (
                  <div className="px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Date
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">
                      {extracted.eventDateLabel}
                    </dd>
                  </div>
                ) : null}
                {extracted.locationHint ? (
                  <div className="px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Location
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">
                      {extracted.locationHint}
                    </dd>
                  </div>
                ) : null}
                {extracted.suggestsQuarterAuction ? (
                  <div className="px-4 py-3">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Event type
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">Quarter auction</dd>
                  </div>
                ) : null}
              </dl>

              {extracted.sourceNotes.length > 0 ? (
                <p className="text-xs text-muted-foreground">{extracted.sourceNotes.join(' ')}</p>
              ) : null}

              {filtersWouldChange && !promptDismissed ? (
                <div
                  className={cn(
                    'rounded-xl border border-harvest-200 bg-harvest-50 px-4 py-3',
                    extracted.confidence === 'high' && 'border-forest/30 bg-forest/5'
                  )}
                  role="status"
                >
                  <p className="text-sm font-medium text-foreground">
                    Would you like to update your current filter selections?
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    We can apply the extracted date
                    {extracted.suggestsQuarterAuction && !quarterAuctionsOnly
                      ? ' and turn on the Quarter auctions filter'
                      : ''}
                    .
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={applySuggestedFilters}>
                      Update filters
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPromptDismissed(true)}
                    >
                      Keep current filters
                    </Button>
                  </div>
                </div>
              ) : null}

              {!filtersWouldChange && !promptDismissed ? (
                <p className="text-sm text-muted-foreground">
                  Your current filters already match what we found, or we couldn&apos;t detect
                  enough detail to suggest changes.
                </p>
              ) : null}
            </div>
          ) : null}

          {!hasExtractedDetails && !parsing ? (
            <div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-muted-foreground">
              <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                We saved your flyer preview but couldn&apos;t extract event details automatically.
                Try a clearer photo or adjust filters manually below.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </section>
  )
}
