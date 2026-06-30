'use client'

import { useEffect } from 'react'
import { toast } from '@/lib/toast'
import { ConfettiBurst } from '@/components/charitable-impact/confetti-burst'
import { formatImpactDollars, type CharityMilestone } from '@/lib/charitable-impact/milestones'
import { Button } from '@/components/ui/button'

interface MilestoneCelebrationProps {
  milestone: CharityMilestone | null
  totalCents: number
  onDismiss: () => void
}

export function MilestoneCelebration({
  milestone,
  totalCents,
  onDismiss,
}: MilestoneCelebrationProps) {
  const active = !!milestone

  useEffect(() => {
    if (!milestone) return

    toast.success(`Milestone achieved together! 🥳`, {
      description: `${formatImpactDollars(milestone.amountCents)} unlocked for ${milestone.label}.`,
      duration: 6000,
    })

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([120, 60, 120, 60, 200])
    }
  }, [milestone])

  if (!milestone) return null

  return (
    <>
      <ConfettiBurst active={active} />
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4"
        role="alertdialog"
        aria-labelledby="milestone-title"
        aria-describedby="milestone-desc"
      >
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" aria-hidden />
        <div className="relative z-10 w-full max-w-md animate-in zoom-in-95 rounded-2xl bg-white p-8 text-center shadow-2xl">
          <p className="text-5xl" aria-hidden>
            🥳
          </p>
          <h2 id="milestone-title" className="mt-2 text-2xl font-bold text-forest">
            Milestone achieved together!
          </h2>
          <p id="milestone-desc" className="mt-2 text-lg font-semibold text-foreground">
            {milestone.label}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            The community crossed {formatImpactDollars(milestone.amountCents)} — total raised now{' '}
            {formatImpactDollars(totalCents)}.
          </p>
          <Button type="button" className="mt-6 w-full" onClick={onDismiss}>
            Keep the momentum going
          </Button>
        </div>
      </div>
    </>
  )
}
