'use client'

import { Badge } from '@/components/ui/badge'
import { ClipboardList, CreditCard, DollarSign, Filter, LayoutGrid, TrendingUp } from 'lucide-react'

const MOCK_APPLICANTS = [
  { name: 'Riverbend Bakery Co.', category: 'Baked Goods', status: 'Pending review' },
  { name: 'Copper Kettle Ceramics', category: 'Artisan', status: 'Documents ready' },
  { name: 'North Shore Honey', category: 'Pantry', status: 'Insurance uploaded' },
  { name: 'Willow & Wren Textiles', category: 'Fiber Arts', status: 'Awaiting reply' },
]

export function ExternalListingVendorInboxMock() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="market-panel-header shrink-0 rounded-none border-0 border-b border-stone-200/80 bg-gradient-to-r from-card via-card to-emerald-50/30 px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90">
              Curation queue
            </p>
            <h2 className="market-panel-title text-base">Market intake</h2>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0 border-harvest-300 bg-harvest-50 text-harvest-800">
          4 pending
        </Badge>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-3 py-3">
        <label className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5" aria-hidden />
          Active market profile
        </label>
        <div className="mb-4 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700">
          Summer Makers Market
        </div>

        <div className="space-y-2">
          {MOCK_APPLICANTS.map((applicant) => (
            <div
              key={applicant.name}
              className="rounded-xl border border-stone-200/90 bg-stone-50/80 px-3 py-3 text-left"
            >
              <div className="flex items-start gap-2">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-stone-900">{applicant.name}</p>
                  <p className="text-xs text-muted-foreground">{applicant.category}</p>
                  <p className="mt-1 text-[11px] font-medium text-emerald-700">{applicant.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ExternalListingMapBuilderMock() {
  const booths = [
    { id: 'a', className: 'col-start-2 row-start-2' },
    { id: 'b', className: 'col-start-4 row-start-2' },
    { id: 'c', className: 'col-start-6 row-start-2' },
    { id: 'd', className: 'col-start-3 row-start-4' },
    { id: 'e', className: 'col-start-5 row-start-4' },
    { id: 'f', className: 'col-start-4 row-start-6' },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f8f6f2]">
      <div className="flex shrink-0 items-center justify-between border-b border-stone-200/80 bg-white/90 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
            HubGrid
          </p>
          <h2 className="flex items-center gap-2 text-base font-semibold text-stone-900">
            <LayoutGrid className="h-4 w-4 text-stone-600" aria-hidden />
            Map builder
          </h2>
        </div>
        <Badge variant="outline">Main Hall · 80′ × 60′</Badge>
      </div>

      <div className="relative min-h-0 flex-1 p-6">
        <div
          className="absolute inset-6 rounded-xl border border-stone-300/80 bg-white shadow-inner"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(120,113,108,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,113,108,0.08) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          <div className="grid h-full grid-cols-8 grid-rows-8 gap-2 p-4">
            {booths.map((booth) => (
              <div
                key={booth.id}
                className={`rounded-md border-2 border-dashed border-emerald-400/70 bg-emerald-50/80 ${booth.className}`}
              />
            ))}
            <div className="col-start-1 row-span-2 row-start-4 rounded-md bg-stone-300/50" />
            <div className="col-span-2 col-start-7 row-start-7 rounded-md bg-amber-100/80 ring-1 ring-amber-300/60" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function ExternalListingInvoicingMock() {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="market-panel-header shrink-0 rounded-none border-0 border-b border-stone-200/80 bg-gradient-to-r from-card via-card to-emerald-50/30 px-4 py-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700/90">
            Payments
          </p>
          <h2 className="market-panel-title text-base">Telemetry desk</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" aria-hidden />
              Collected
            </div>
            <p className="mt-1 text-xl font-bold text-stone-900">$4,280</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              Fill rate
            </div>
            <p className="mt-1 text-xl font-bold text-stone-900">72%</p>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CreditCard className="h-4 w-4" aria-hidden />
            Booth payment matrix
          </div>
          <div className="mt-3 space-y-2">
            {['Paid · 18 booths', 'Pending · 6 booths', 'VIP hold · 2 booths'].map((row) => (
              <div
                key={row}
                className="rounded-lg border border-white/80 bg-white/90 px-3 py-2 text-sm text-stone-700"
              >
                {row}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
