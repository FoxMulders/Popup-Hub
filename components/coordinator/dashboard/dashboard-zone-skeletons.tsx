import { cn } from '@/lib/utils'

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md bg-stone-200/80 motion-safe:animate-pulse',
        className
      )}
      aria-hidden
    />
  )
}

export function CurationZoneSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)} aria-hidden>
      <div className="shrink-0 border-b border-stone-200/80 bg-card/90 px-4 py-3">
        <ShimmerBar className="h-2.5 w-24" />
        <ShimmerBar className="mt-2 h-5 w-36" />
      </div>
      <div className="flex-1 space-y-3 px-3 py-3">
        <ShimmerBar className="h-9 w-full" />
        <ShimmerBar className="h-16 w-full rounded-xl" />
        <ShimmerBar className="h-16 w-full rounded-xl" />
        <ShimmerBar className="h-24 w-full rounded-xl" />
      </div>
    </div>
  )
}

export function TelemetryZoneSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)} aria-hidden>
      <div className="shrink-0 border-b border-stone-200/80 bg-card/90 px-4 py-3">
        <ShimmerBar className="h-2.5 w-20" />
        <ShimmerBar className="mt-2 h-5 w-28" />
      </div>
      <div className="grid flex-1 grid-cols-2 gap-2 px-4 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerBar key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function CanvasZoneSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 items-center justify-center bg-canvas/60 p-6',
        className
      )}
      aria-hidden
    >
      <div className="h-full w-full max-w-3xl rounded-xl border border-dashed border-stone-300/90 bg-card/40" />
    </div>
  )
}
