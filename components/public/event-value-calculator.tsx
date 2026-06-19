'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCadCurrency } from '@/lib/coordinator/booth-placement-status'

const HOURS_SAVED_PER_VENDOR = 0.25
const HOURS_SAVED_LAYOUT = 3
const HOURS_SAVED_PAYMENTS = 2

export function EventValueCalculator() {
  const [marketsPerYear, setMarketsPerYear] = useState(12)
  const [vendorsPerMarket, setVendorsPerMarket] = useState(40)
  const [manualAppHours, setManualAppHours] = useState(6)
  const [manualLayoutHours, setManualLayoutHours] = useState(5)
  const [manualPaymentHours, setManualPaymentHours] = useState(4)
  const [hourlyRate, setHourlyRate] = useState(35)

  const results = useMemo(() => {
    const appsSaved = Math.max(0, manualAppHours - vendorsPerMarket * HOURS_SAVED_PER_VENDOR)
    const layoutSaved = Math.max(0, manualLayoutHours - HOURS_SAVED_LAYOUT)
    const paySaved = Math.max(0, manualPaymentHours - HOURS_SAVED_PAYMENTS)
    const hoursPerMarket = appsSaved + layoutSaved + paySaved
    const hoursPerYear = hoursPerMarket * marketsPerYear
    const valuePerYear = hoursPerYear * hourlyRate
    return { hoursPerMarket, hoursPerYear, valuePerYear }
  }, [
    hourlyRate,
    manualAppHours,
    manualLayoutHours,
    manualPaymentHours,
    marketsPerYear,
    vendorsPerMarket,
  ])

  return (
    <section className="border-y border-stone-200/60 bg-white px-4 py-16 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">ROI</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            How much coordinator time could you save?
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Compare your current spreadsheet workflow to Popup Hub for applications, layout, and
            booth payments. Platform fee is 3% + $1 per booth transaction — pass it to vendors if
            you want to keep 100% of your listed booth price.
          </p>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <div className="marketing-glass-card space-y-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="calc-markets">Markets per year</Label>
                <Input
                  id="calc-markets"
                  type="number"
                  min={1}
                  max={365}
                  value={marketsPerYear}
                  onChange={(e) => setMarketsPerYear(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calc-vendors">Vendors per market</Label>
                <Input
                  id="calc-vendors"
                  type="number"
                  min={1}
                  max={500}
                  value={vendorsPerMarket}
                  onChange={(e) => setVendorsPerMarket(Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calc-apps">Manual application hours / market</Label>
                <Input
                  id="calc-apps"
                  type="number"
                  min={0}
                  step={0.5}
                  value={manualAppHours}
                  onChange={(e) => setManualAppHours(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calc-layout">Manual layout hours / market</Label>
                <Input
                  id="calc-layout"
                  type="number"
                  min={0}
                  step={0.5}
                  value={manualLayoutHours}
                  onChange={(e) => setManualLayoutHours(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calc-pay">Manual payment reconciliation / market</Label>
                <Input
                  id="calc-pay"
                  type="number"
                  min={0}
                  step={0.5}
                  value={manualPaymentHours}
                  onChange={(e) => setManualPaymentHours(Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="calc-rate">Your time value ($/hr)</Label>
                <Input
                  id="calc-rate"
                  type="number"
                  min={0}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="marketing-glass-card flex flex-col justify-center p-6">
            <p className="text-sm font-medium text-muted-foreground">Estimated time saved</p>
            <p className="mt-2 text-4xl font-bold tabular-nums text-forest">
              {results.hoursPerYear.toFixed(1)} hrs
              <span className="text-lg font-semibold text-muted-foreground"> / year</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              ~{results.hoursPerMarket.toFixed(1)} hours back per market
            </p>
            <p className="mt-6 text-sm font-medium text-muted-foreground">Coordinator time value</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatCadCurrency(Math.round(results.valuePerYear * 100))}
              <span className="text-base font-semibold text-muted-foreground"> / year</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
