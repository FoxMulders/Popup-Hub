import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Trophy } from 'lucide-react'
import { formatCents } from '@/lib/square/client'

interface PaddleCardProps {
  paddleId: string
  totalCents: number
  dropCount: number
  rank: number
  isWinner?: boolean
  isYou?: boolean
}

export function PaddleCard({
  paddleId,
  totalCents,
  dropCount,
  rank,
  isWinner = false,
  isYou = false,
}: PaddleCardProps) {
  return (
    <Card
      className={`transition-all ${
        isWinner
          ? 'ring-2 ring-yellow-400 bg-yellow-50 shadow-lg'
          : isYou
          ? 'ring-2 ring-amber-400 bg-amber-50'
          : 'hover:shadow-sm'
      }`}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            rank === 1
              ? 'bg-yellow-400 text-yellow-900'
              : rank === 2
              ? 'bg-gray-300 text-gray-700'
              : rank === 3
              ? 'bg-amber-600 text-white'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono font-semibold text-sm">{paddleId}</p>
            {isYou && (
              <Badge className="bg-amber-100 text-amber-700 text-[10px]">You</Badge>
            )}
            {isWinner && (
              <Badge className="bg-yellow-400 text-yellow-900 text-[10px] gap-1">
                <Trophy className="h-2.5 w-2.5" />
                Winner!
              </Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {dropCount} drop{dropCount !== 1 ? 's' : ''}
          </p>
        </div>

        <p className="font-bold text-gray-900 shrink-0">{formatCents(totalCents)}</p>
      </CardContent>
    </Card>
  )
}
