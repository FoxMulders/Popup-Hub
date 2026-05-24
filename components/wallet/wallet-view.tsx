'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { formatCents } from '@/lib/square/client'
import { centsToCredits, formatCredits } from '@/lib/quarter-auction/credits'
import type { Wallet, WalletTransaction } from '@/types/database'
import { AlternativeDepositPanel } from '@/components/wallet/alternative-deposit-panel'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Wallet as WalletIcon,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Trophy,
  RefreshCcw,
  Loader2,
  HelpCircle,
  Gavel,
  Banknote,
  Send,
} from 'lucide-react'
import Script from 'next/script'
import { format } from 'date-fns'

const DEPOSIT_AMOUNTS = [500, 1000, 2500, 5000] // cents

interface WalletViewProps {
  wallet: Wallet | null
  transactions: WalletTransaction[]
  userId: string
}

const TX_LABELS: Record<string, string> = {
  deposit: 'Credit purchase',
  withdrawal: 'Withdrawal',
  quarter_drop: 'Quarter drop',
  auction_win: 'Auction win',
  refund: 'Refund',
  paddle_purchase: 'Virtual paddle',
  bid_entry: 'Auction bid entry',
}

const TX_ICONS: Record<string, React.ReactNode> = {
  deposit: <ArrowDownLeft className="h-4 w-4 text-green-500" />,
  withdrawal: <ArrowUpRight className="h-4 w-4 text-red-500" />,
  quarter_drop: <Coins className="h-4 w-4 text-amber-500" />,
  auction_win: <Trophy className="h-4 w-4 text-yellow-500" />,
  refund: <RefreshCcw className="h-4 w-4 text-blue-500" />,
  paddle_purchase: <Coins className="h-4 w-4 text-forest" />,
  bid_entry: <Gavel className="h-4 w-4 text-amber-600" />,
}

function txLabel(tx: WalletTransaction): string {
  const method = (tx.metadata as Record<string, unknown> | undefined)?.method
  if (tx.type === 'deposit' && method === 'cash_at_door') return 'Cash at door'
  if (tx.type === 'deposit' && method === 'etransfer') return 'E-transfer top-up'
  return TX_LABELS[tx.type] ?? tx.type.replace(/_/g, ' ')
}

function txIcon(tx: WalletTransaction): React.ReactNode {
  const method = (tx.metadata as Record<string, unknown> | undefined)?.method
  if (method === 'cash_at_door') return <Banknote className="h-4 w-4 text-forest" />
  if (method === 'etransfer') return <Send className="h-4 w-4 text-blue-600" />
  return TX_ICONS[tx.type]
}

interface SquareCardInstance {
  attach: (element: HTMLElement) => Promise<void>
  tokenize: () => Promise<{
    status: string
    token?: string
    errors?: { message: string }[]
  }>
}

export function WalletView({ wallet, transactions, userId }: WalletViewProps) {
  const [squareLoaded, setSquareLoaded] = useState(false)
  const [depositAmount, setDepositAmount] = useState(1000)
  const [depositing, setDepositing] = useState(false)
  const [showCard, setShowCard] = useState(false)
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState<SquareCardInstance | null>(null)

  useEffect(() => {
    if (showCard && squareLoaded && cardContainerRef.current) {
      initCard()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCard, squareLoaded])

  async function initCard() {
    if (!window.Square) return
    try {
      const payments = await window.Square.payments(
        process.env.NEXT_PUBLIC_SQUARE_APP_ID!,
        process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID!
      )
      // @ts-expect-error Square SDK dynamic
      const newCard = await payments.card()
      if (cardContainerRef.current) {
        await newCard.attach(cardContainerRef.current)
        setCard(newCard)
      }
    } catch {
      toast.error('Failed to load payment form.')
    }
  }

  async function handleDeposit() {
    if (!card) {
      toast.error('Payment form not ready.')
      return
    }
    setDepositing(true)
    try {
      const result = await card.tokenize()
      if (result.status !== 'OK') {
        toast.error(result.errors?.[0]?.message ?? 'Card error')
        return
      }

      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: result.token, amountCents: depositAmount }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'Deposit failed')
      } else {
        toast.success(`${formatCents(depositAmount)} added to your wallet!`)
        setShowCard(false)
        window.location.reload()
      }
    } finally {
      setDepositing(false)
    }
  }

  const paddleId = wallet?.paddle_id
  const balance = wallet?.balance ?? 0

  return (
    <div className="space-y-6">
      <Script
        src="https://web.squarecdn.com/v1/square.js"
        onLoad={() => setSquareLoaded(true)}
      />

      {/* Balance card */}
      <Card className="overflow-hidden border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500">
              <WalletIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-gray-500">Available Balance</p>
                <Tooltip>
                  <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    Credits for quarter auctions. 1 credit = $0.25. Used for virtual paddles and bid
                    entries.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-3xl font-bold text-gray-900">{formatCents(balance)}</p>
              <p className="text-sm text-gray-600">{formatCredits(centsToCredits(balance))}</p>
            </div>
          </div>

          {paddleId ? (
            <div className="mt-4 flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-gray-600">Paddle ID:</span>
              <Badge className="bg-amber-500 font-mono text-white">#{paddleId}</Badge>
            </div>
          ) : (
            <p className="mt-3 text-xs text-gray-400">
              Add funds to get a permanent Paddle ID for auctions.
            </p>
          )}
        </CardContent>
      </Card>

      <AlternativeDepositPanel userId={userId} />

      {/* Add funds — card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-green-500" />
            Add Funds with Card
            <Tooltip>
              <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Add funds to your wallet. Minimum $5. Funds are available immediately.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DEPOSIT_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => setDepositAmount(amount)}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                  depositAmount === amount
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-green-300'
                }`}
              >
                {formatCents(amount)}
              </button>
            ))}
          </div>

          {!showCard ? (
            <Button
              className="w-full bg-green-500 hover:bg-green-600 text-white"
              onClick={() => setShowCard(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add {formatCents(depositAmount)}
            </Button>
          ) : (
            <div className="space-y-3">
              <div ref={cardContainerRef} className="min-h-[100px] rounded-lg border p-3" />
              <p className="text-xs text-gray-400 text-center">Secured by Square</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowCard(false)
                    setCard(null)
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleDeposit}
                  disabled={depositing || !card}
                >
                  {depositing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Pay {formatCents(depositAmount)}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Transaction History
            <Tooltip>
              <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-gray-400" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">A record of all deposits, withdrawals, auction drops, and winnings.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No transactions yet.</p>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-gray-50">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 flex-shrink-0">
                    {txIcon(tx)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{txLabel(tx)}</p>
                    <p className="text-xs text-gray-400">
                      {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}{formatCents(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
