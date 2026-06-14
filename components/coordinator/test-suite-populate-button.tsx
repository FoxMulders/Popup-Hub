'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOptionalMarketManagement } from '@/components/coordinator/dashboard/market-management-context'

export interface TestSuitePopulateButtonProps {
  eventId: string
  compact?: boolean
  className?: string
}

export function TestSuitePopulateButton({
  eventId,
  compact = false,
  className,
}: TestSuitePopulateButtonProps) {
  const router = useRouter()
  const market = useOptionalMarketManagement()
  const [running, setRunning] = useState(false)

  async function handlePopulate() {
    if (running) return
    setRunning(true)
    try {
      const response = await fetch(`/api/coordinator/events/${eventId}/seed-test-suite`, {
        method: 'POST',
      })
      const body = (await response.json()) as {
        error?: string
        applicationCount?: number
        tableSlots?: number
        skippedForCapacity?: number
        targetVendorCount?: number
      }

      if (!response.ok) {
        toast.error(body.error ?? 'Could not populate test suite')
        return
      }

      await market?.refreshApprovedPool(eventId)
      router.refresh()

      const skipped =
        body.skippedForCapacity && body.skippedForCapacity > 0
          ? ` (${body.skippedForCapacity} skipped — category caps)`
          : ''

      toast.success(
        `Test suite ready: ${body.applicationCount ?? 0} approved & paid vendors (${body.tableSlots ?? 0} tables)${skipped}. Use AI Auto-Arrange or drag vendors from the approved pool.`,
        { duration: 8000 }
      )
    } finally {
      setRunning(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={running}
      onClick={() => void handlePopulate()}
      className={cn(
        'shrink-0 gap-1.5 border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100',
        compact ? 'h-8 px-2.5 text-xs' : 'h-9',
        className
      )}
      title="Seed approved, paid vendors up to your market category capacity for layout QA"
    >
      <FlaskConical className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden />
      {running ? 'Populating…' : compact ? 'Test suite' : 'Populate test suite'}
    </Button>
  )
}
