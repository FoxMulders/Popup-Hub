'use client'

interface MlmTierGuardProps {
  globalMlmCap: number
  onGlobalMlmCapChange: (cap: number) => void
  activeMlmSlots: number
}

export function MlmTierGuard({
  globalMlmCap,
  onGlobalMlmCapChange,
  activeMlmSlots,
}: MlmTierGuardProps) {
  return (
    <div className="border-2 border-black p-4 bg-yellow-50 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] my-4">
      <h4 className="font-bold uppercase tracking-wide text-sm flex items-center gap-2">
        🛡️ MLM Tier Curation Guard
      </h4>
      <p className="text-xs text-foreground mt-1 whitespace-normal break-words">
        Brands are capped at 1 slot each to prevent internal competition. Set the maximum total MLM
        profiles allowed in this showcase:
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <label htmlFor="global-mlm-cap" className="text-xs font-bold uppercase">
          Max Overall MLMs:
        </label>
        <input
          id="global-mlm-cap"
          type="number"
          min={0}
          max={50}
          value={globalMlmCap}
          onChange={(e) => onGlobalMlmCapChange(Math.max(0, Number(e.target.value) || 0))}
          className="border-2 border-black p-1 w-16 text-center font-bold bg-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        />
        <span className="text-xs text-muted-foreground italic whitespace-normal break-words">
          (Remaining brands queue as FCFS waitlist once met — {activeMlmSlots}/{globalMlmCap} active)
        </span>
      </div>
    </div>
  )
}
