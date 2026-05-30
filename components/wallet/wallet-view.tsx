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
import { WalletReclaimPanel } from '@/components/wallet/wallet-reclaim-panel'
import { WalletAmountChips } from '@/components/wallet/wallet-amount-chips'
import { WalletCardTitle } from '@/components/wallet/wallet-card-title'
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
  History,
} from 'lucide-react'
import Script from 'next/script'
import { format } from 'date-fns'

const DEPOSIT_AMOUNTS = [500, 1000, 2500, 5000] // cents

interface WalletViewProps {
  wallet: Wallet | null
  transactions: WalletTransaction[]
  userId: string
  userEmail?: string
}

const TX_LABELS: Record<string, string> = {
  deposit: 'Quarter purchase',
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
  quarter_drop: <Coins className="h-4 w-4 text-harvest-500" />,
  auction_win: <Trophy className="h-4 w-4 text-yellow-500" />,
  refund: <RefreshCcw className="h-4 w-4 text-blue-500" />,
  paddle_purchase: <Coins className="h-4 w-4 text-forest" />,
  bid_entry: <Gavel className="h-4 w-4 text-harvest-600" />,
}

function txLabel(tx: WalletTransaction): string {
  const method = (tx.metadata as Record<string, unknown> | undefined)?.method
  if (tx.type === 'deposit' && method === 'cash_at_door') return 'Cash at door'
  if (tx.type === 'deposit' && method === 'etransfer') return 'E-transfer top-up'
  if (tx.type === 'withdrawal' && method === 'cash_at_door_reclaim') return 'Cash reclaim'
  if (tx.type === 'withdrawal' && method === 'etransfer_reclaim') return 'E-transfer reclaim'
  if (tx.type === 'withdrawal' && method === 'card_refund') return 'Card refund'
  if (tx.type === 'refund' && method === 'reclaim_reversal') return 'Reclaim cancelled'
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

export function WalletView({ wallet, transactions, userId, userEmail = '' }: WalletViewProps) {
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
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Script
        src="https://web.squarecdn.com/v1/square.js"
        onLoad={() => setSquareLoaded(true)}
      />

      {/* Balance card */}
      <Card className="overflow-hidden border-2 border-harvest-200 bg-gradient-to-br from-linen via-canvas to-harvest-50">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-harvest-500 sm:h-12 sm:w-12">
              <WalletIcon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm text-muted-foreground">Available Balance</p>
                <Tooltip>
                  <TooltipTrigger type="button" className="touch-manipulation">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[min(18rem,calc(100vw-2rem))]">
                    Quarters for quarter auctions. 1 quarter = $0.25. Used for virtual paddles and bid
                    entries.
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-2xl font-bold tabular-nums text-foreground sm:text-3xl">
                {formatCents(balance)}
              </p>
              <p className="text-sm text-muted-foreground">{formatCredits(centsToCredits(balance))}</p>
            </div>
          </div>

          {paddleId ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Coins className="h-4 w-4 shrink-0 text-harvest-500" />
              <span className="text-sm text-muted-foreground">Paddle ID:</span>
              <Badge className="max-w-full truncate bg-harvest-500 font-mono text-white">
                #{paddleId}
              </Badge>
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              Add funds to get a permanent Paddle ID for auctions.
            </p>
          )}
        </CardContent>
      </Card>

      <AlternativeDepositPanel userId={userId} />

      {balance > 0 ? (
        <WalletReclaimPanel userId={userId} userEmail={userEmail} balanceCents={balance} />
      ) : null}

      {/* Add funds — card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4 text-green-500" />
            Add Funds with Card
            <Tooltip>
              <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
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
                    ? 'border-sage-500 bg-sage-50 text-sage-800'
                    : 'border-stone-200 hover:border-green-300'
                }`}
              >
                {formatCents(amount)}
              </button>
            ))}
          </div>

          {!showCard ? (
            <Button
              className="w-full bg-sage-500 hover:bg-green-600 text-white"
              onClick={() => setShowCard(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add {formatCents(depositAmount)}
            </Button>
          ) : (
            <div className="space-y-3">
              <div ref={cardContainerRef} className="min-h-[100px] rounded-lg border p-3" />
              <p className="text-xs text-muted-foreground text-center">Secured by Square</p>
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
                  className="flex-1 bg-sage-500 hover:bg-green-600 text-white"
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
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="text-base font-semibold">
            <WalletCardTitle
              icon={<History className="h-4 w-4 text-muted-foreground" />}
              trailing={
                <Tooltip>
                  <TooltipTrigger type="button" className="touch-manipulation">
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[min(18rem,calc(100vw-2rem))]">
                    A record of all deposits, withdrawals, auction drops, and winnings.
                  </TooltipContent>
                </Tooltip>
              }
            >
              Transaction History
            </WalletCardTitle>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
          {transactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {transactions.map((tx) => (
                <li
                  key={tx.id}
                  className="flex gap-3 py-3 first:pt-0 last:pb-0 sm:items-center"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-stone-100">
                    {txIcon(tx)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-snug text-foreground">{txLabel(tx)}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {format(new Date(tx.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 self-start text-sm font-semibold tabular-nums sm:self-center ${
                      tx.amount > 0 ? 'text-green-600' : 'text-red-500'
                    }`}
                  >
                    {tx.amount > 0 ? '+' : ''}
                    {formatCents(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
