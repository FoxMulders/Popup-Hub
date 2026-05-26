'use client'

interface MlmTierGuardProps {
  globalMlmCap: number
  onGlobalMlmCapChange: (cap: number) => void
  /** @deprecated MLM cap is enforced at approval time, not on the listed slot count. */
  activeMlmSlots?: number
}

export function MlmTierGuard({ globalMlmCap, onGlobalMlmCapChange }: MlmTierGuardProps) {
  return (
    <div className="rounded-xl border border-stone-200 bg-harvest-50/40 px-4 py-3">
      <h4 className="font-semibold text-sm flex items-center gap-2 text-foreground">
        <span aria-hidden>🛡️</span> MLM approval cap
      </h4>
      <p className="mt-1 text-xs text-muted-foreground whitespace-normal break-words">
        List as many MLM brands as you want — each is locked to one booth slot. The cap below only
        limits how many MLM applicants you can approve at this market; remaining brands queue as a
        first-come waitlist.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label htmlFor="global-mlm-cap" className="text-xs font-semibold uppercase tracking-wide">
          Max MLMs to approve
        </label>
        <input
          id="global-mlm-cap"
          type="number"
          min={0}
          max={50}
          value={globalMlmCap}
          onChange={(e) => onGlobalMlmCapChange(Math.max(0, Number(e.target.value) || 0))}
          className="h-9 w-20 rounded-lg border-2 border-stone-200 bg-card px-2 text-center text-sm font-semibold tabular-nums focus:border-harvest-500 focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">
          enforced at approval — applicants beyond this stay pending until a slot opens.
        </span>
      </div>
    </div>
  )
}
