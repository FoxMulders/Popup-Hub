'use client'

import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Ticket, Trophy } from 'lucide-react'

interface PatronPaddleCardProps {
  paddleNumber: number
  scannedCount: number
  vendorsRequired: number
  bonusEligible: boolean
  className?: string
}

export function PatronPaddleCard({
  paddleNumber,
  scannedCount,
  vendorsRequired,
  bonusEligible,
  className,
}: PatronPaddleCardProps) {
  const progressPct = vendorsRequired > 0 ? Math.min(100, (scannedCount / vendorsRequired) * 100) : 0

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-harvest-200 bg-gradient-to-br from-harvest-50 via-white to-sage-50 shadow-sm',
        className
      )}
    >
      <div className="flex items-stretch">
        <div className="flex flex-col items-center justify-center border-r border-harvest-100 bg-harvest-600 px-5 py-6 text-white">
          <Ticket className="mb-2 h-5 w-5 opacity-90" aria-hidden />
          <p className="text-[10px] font-semibold uppercase tracking-widest opacity-90">
            Paddle
          </p>
          <p className="font-heading text-4xl font-bold tabular-nums leading-none">
            {paddleNumber}
          </p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">Your digital paddle</p>
            {bonusEligible ? (
              <Badge className="gap-1 bg-sage-600 text-white">
                <Trophy className="h-3 w-3" />
                Bonus unlocked
              </Badge>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Vendors scanned</span>
              <span className="font-semibold tabular-nums text-foreground">
                {scannedCount} / {vendorsRequired} required for bonus
              </span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>

          <p className="text-xs text-muted-foreground">
            Visit vendor booths and scan their passport QR codes to fill your card.
          </p>
        </div>
      </div>
    </div>
  )
}
