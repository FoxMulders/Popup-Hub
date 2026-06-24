'use client'

import { Save } from 'lucide-react'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'
import { useHubGridHeader } from './hub-grid-header-context'

/** Save draft + Save & deploy — unified header CTAs for HubGrid blueprint. */
export function HubGridHeaderSaveActions({ className }: { className?: string }) {
  const { saveDraftLoading, saveMarketLoading, onSaveDraft, onSaveMarket } =
    useHubGridHeader()

  return (
    <span
      data-layout-help="save-actions"
      className={cn('inline-flex shrink-0 items-center gap-1.5', className)}
    >
      <TooltipWrapper
        text={saveDraftLoading ? 'Saving layout draft…' : 'Save layout draft without deploying'}
      >
        <button
          type="button"
          onClick={() => void onSaveDraft()}
          disabled={saveDraftLoading}
          aria-label={saveDraftLoading ? 'Saving layout draft' : 'Save layout draft'}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Save draft</span>
        </button>
      </TooltipWrapper>
      <TooltipWrapper
        text={saveMarketLoading ? 'Saving market…' : 'Save market and deploy'}
      >
        <button
          type="button"
          onClick={() => void onSaveMarket()}
          disabled={saveMarketLoading}
          aria-label={saveMarketLoading ? 'Saving market' : 'Save market and deploy'}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-stone-900 px-2.5 text-xs font-semibold text-white shadow-sm hover:bg-stone-800 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Save & deploy</span>
        </button>
      </TooltipWrapper>
    </span>
  )
}
