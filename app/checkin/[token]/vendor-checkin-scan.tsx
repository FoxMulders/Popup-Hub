'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { MapPin, Calendar, CheckCircle2 } from 'lucide-react'
import { resolveGridConfig } from '@/lib/booth-planner/grid-config'
import { buildVenueElementMap, isElementOrigin } from '@/lib/booth-planner/venue-elements'
import { ELEMENT_STYLES } from '@/lib/booth-planner/venue-elements'
import type { BoothLayout, BoothCell } from '@/types/database'
import { VendorCheckinHubguardPrompt } from '@/components/vendor/vendor-checkin-hubguard-prompt'

interface VendorCheckinScanProps {
  application: {
    id: string
    checked_in: boolean
    booth_number: number | null
    vendor: { full_name: string }
    passport: { business_name: string } | null
    category: { name: string } | null
    event: { id: string; name: string; location_name: string; start_at: string }
  }
  layout: BoothLayout | null
  hubGuardReview?: {
    reviewHref: string
    organizerName: string | null
    eventName: string
    alreadyReviewed?: boolean
  }
}

type State = 'checking-in' | 'success' | 'already-checked-in' | 'error'

export function VendorCheckinScan({ application, layout, hubGuardReview }: VendorCheckinScanProps) {
  const supabase = createClient()
  const [state, setState] = useState<State>(
    application.checked_in ? 'already-checked-in' : 'checking-in'
  )

  const displayName = application.passport?.business_name ?? application.vendor.full_name

  useEffect(() => {
    if (application.checked_in) return

    async function performCheckin() {
      const { error } = await supabase
        .from('booth_applications')
        .update({ checked_in: true })
        .eq('id', application.id)

      if (error) {
        setState('error')
      } else {
        setState('success')
      }
    }

    performCheckin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSuccess = state === 'success' || state === 'already-checked-in'

  return (
    <main className="market-page min-h-screen flex flex-col items-center justify-start px-4 pt-10 pb-16">
      <article className="w-full max-w-sm space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          {state === 'checking-in' && (
            <div className="h-20 w-20 rounded-full bg-canvas border-2 border-stone-200 flex items-center justify-center">
              <div className="h-10 w-10 rounded-full border-4 border-forest border-t-transparent animate-spin" />
            </div>
          )}
          {isSuccess && (
            <div className="h-20 w-20 rounded-full bg-sage-100 border-2 border-sage-200 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-sage-700" />
            </div>
          )}
          {state === 'error' && (
            <div className="h-20 w-20 rounded-full bg-terracotta-50 border-2 border-terracotta-200 flex items-center justify-center">
              <span className="text-4xl" aria-hidden>⚠️</span>
            </div>
          )}

          {state === 'checking-in' && (
            <p className="text-lg font-heading font-semibold text-muted-foreground">Checking you in…</p>
          )}
          {state === 'success' && (
            <>
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                Welcome, {displayName}!
              </h1>
              <p className="text-base text-sage-700 font-medium">You&apos;re checked in ✓</p>
            </>
          )}
          {state === 'already-checked-in' && (
            <>
              <h1 className="font-heading text-2xl font-semibold text-foreground">
                Hey, {displayName}!
              </h1>
              <p className="text-base text-harvest-700 font-medium">Already checked in</p>
            </>
          )}
          {state === 'error' && (
            <>
              <h1 className="font-heading text-xl font-semibold text-foreground">Check-In Failed</h1>
              <p className="text-sm text-muted-foreground">
                Something went wrong. Please ask a coordinator to check you in manually.
              </p>
            </>
          )}
        </header>

        {isSuccess && (
          <section className="market-panel p-5 space-y-4">
            {application.booth_number != null ? (
              <dl className="flex flex-col items-center gap-1 py-2">
                <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Your Booth
                </dt>
                <dd className="font-heading text-6xl font-bold text-forest tabular-nums">
                  #{application.booth_number}
                </dd>
              </dl>
            ) : (
              <p className="text-center text-sm text-muted-foreground">No booth assigned yet.</p>
            )}

            <div className="h-px bg-stone-200" />

            <div className="space-y-2">
              <p className="font-heading font-semibold text-foreground text-base">
                {application.event.name}
              </p>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {format(new Date(application.event.start_at), 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {application.event.location_name}
              </div>
              {application.category && (
                <span className="inline-block rounded-full bg-harvest-50 border border-harvest-200 px-2.5 py-0.5 text-xs font-medium text-harvest-800">
                  {application.category.name}
                </span>
              )}
            </div>
          </section>
        )}

        {isSuccess && layout && application.booth_number != null && (
          <section className="market-panel p-4 space-y-3" aria-label="Floor plan">
            <h2 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide">
              Floor Plan — You are here
            </h2>
            <MiniBoothMap layout={layout} highlightBoothNumber={application.booth_number} />
          </section>
        )}

        {isSuccess && hubGuardReview ? (
          <VendorCheckinHubguardPrompt
            reviewHref={hubGuardReview.reviewHref}
            organizerName={hubGuardReview.organizerName}
            eventName={hubGuardReview.eventName}
            alreadyReviewed={hubGuardReview.alreadyReviewed}
          />
        ) : null}
      </article>
    </main>
  )
}

const CELL_PX = 28

function MiniBoothMap({
  layout,
  highlightBoothNumber,
}: {
  layout: BoothLayout
  highlightBoothNumber: number
}) {
  const { venue_width, venue_length, booth_width, booth_length, entrance, cells, venue_elements, spacing_mode } =
    layout

  const gridConfig = useMemo(
    () =>
      resolveGridConfig({
        venueWidthFt: venue_width,
        venueLengthFt: venue_length,
        boothWidthFt: booth_width,
        boothLengthFt: booth_length,
        spacingMode: spacing_mode ?? 'standard',
      }),
    [venue_width, venue_length, booth_width, booth_length, spacing_mode]
  )

  const cols = gridConfig.cols
  const rows = gridConfig.rows
  const venueMap = useMemo(
    () => buildVenueElementMap(venue_elements ?? []),
    [venue_elements]
  )

  const cellMap = useMemo(() => {
    const map = new Map<string, BoothCell>()
    for (const cell of cells ?? []) {
      if (cell.col >= 0 && cell.row >= 0) {
        for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
          for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
            map.set(`${r}-${c}`, cell)
          }
        }
      }
    }
    return map
  }, [cells])

  const elements = useMemo(() => {
    const out: React.ReactElement[] = []
    const rendered = new Set<string>()

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`
        if (rendered.has(key)) continue

        const booth = cellMap.get(key)
        if (booth && booth.col === c && booth.row === r) {
          for (let dr = 0; dr < booth.rowSpan; dr++) {
            for (let dc = 0; dc < booth.colSpan; dc++) {
              rendered.add(`${r + dr}-${c + dc}`)
            }
          }
          const isHighlighted = booth.boothNumber === highlightBoothNumber
          out.push(
            <div
              key={`booth-${booth.id}`}
              style={{
                gridColumn: `${c + 1} / span ${booth.colSpan}`,
                gridRow: `${r + 1} / span ${booth.rowSpan}`,
              }}
              className={
                isHighlighted
                  ? `${booth.categoryColor} rounded-lg border-2 border-forest ring-2 ring-forest/40 flex items-center justify-center min-h-0`
                  : `${booth.categoryColor} rounded border border-stone-300 opacity-80 flex items-center justify-center min-h-0`
              }
            >
              <span className={`text-[8px] font-bold ${isHighlighted ? 'text-forest' : 'opacity-70'}`}>
                {isHighlighted ? `★ #${booth.boothNumber}` : booth.boothNumber}
              </span>
            </div>
          )
          continue
        }

        const fixture = venueMap.get(key)
        if (fixture && isElementOrigin(fixture, r, c)) {
          const spanC = fixture.colSpan ?? 1
          const spanR = fixture.rowSpan ?? 1
          for (let dr = 0; dr < spanR; dr++) {
            for (let dc = 0; dc < spanC; dc++) {
              rendered.add(`${r + dr}-${c + dc}`)
            }
          }
          const style = ELEMENT_STYLES[fixture.type]
          out.push(
            <div
              key={`fx-${fixture.id}`}
              style={{
                gridColumn: `${c + 1} / span ${spanC}`,
                gridRow: `${r + 1} / span ${spanR}`,
              }}
              className={`rounded ${style.className} min-h-0`}
            />
          )
          continue
        }

        if (fixture) {
          rendered.add(key)
          continue
        }

        out.push(
          <div
            key={key}
            style={{ gridColumn: c + 1, gridRow: r + 1 }}
            className="bg-canvas/50 border border-dotted border-stone-200 rounded min-h-0"
          />
        )
      }
    }
    return out
  }, [rows, cols, cellMap, venueMap, highlightBoothNumber])

  return (
    <div className="overflow-x-auto scroll-touch-x">
      <div
        className="mx-auto rounded-lg border-2 border-stone-200 p-1 bg-card"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, ${CELL_PX}px)`,
          gridTemplateRows: `repeat(${rows}, ${CELL_PX}px)`,
          width: `${cols * CELL_PX + 8}px`,
        }}
        role="img"
        aria-label={`Venue map with booth ${highlightBoothNumber} highlighted near the ${entrance} entrance`}
      >
        {elements}
      </div>
    </div>
  )
}
