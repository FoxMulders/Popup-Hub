'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useOptionalMarketManagement } from '@/components/coordinator/dashboard/market-management-context'

const TEST_SUITE_TOAST_ID = 'test-suite-populate'

type PopulateStage = 'idle' | 'seeding' | 'assigning'

const STAGE_PROGRESS: Record<Exclude<PopulateStage, 'idle'>, number> = {
  seeding: 45,
  assigning: 90,
}

const STAGE_LABEL: Record<Exclude<PopulateStage, 'idle'>, string> = {
  seeding: 'Seeding vendors…',
  assigning: 'Assigning vendors to canvas booths…',
}

export interface TestSuitePopulateResult {
  vendors: number
  tableSlots: number
  boothsFilled: number
  boothsAssigned: number
  boothsRequested: number
  canvasReady: boolean
  roomName: string | null
  error?: string
}

export interface TestSuitePopulateButtonProps {
  eventId: string
  compact?: boolean
  className?: string
  /** Vendor booths already on the active canvas — button stays disabled until ≥1. */
  canvasVendorBoothCount?: number
  /** Setup wizard / spatial editor — assign seeded vendors on the live canvas without router.refresh(). */
  populateTestSuiteOnCanvas?: (eventId: string) => Promise<TestSuitePopulateResult>
}

export function TestSuitePopulateButton({
  eventId,
  compact = false,
  className,
  canvasVendorBoothCount: canvasVendorBoothCountProp,
  populateTestSuiteOnCanvas: populateTestSuiteOnCanvasProp,
}: TestSuitePopulateButtonProps) {
  const router = useRouter()
  const market = useOptionalMarketManagement()
  const [stage, setStage] = useState<PopulateStage>('idle')
  const running = stage !== 'idle'

  const canvasVendorBoothCount =
    canvasVendorBoothCountProp ?? market?.canvasVendorBoothCount ?? 0
  const needsCanvasTables = Boolean(
    populateTestSuiteOnCanvasProp ?? market?.populateTestSuiteOnCanvas
  )
  const disabledForEmptyCanvas = needsCanvasTables && canvasVendorBoothCount < 1
  const disabled = running || disabledForEmptyCanvas

  function showStageProgress(next: Exclude<PopulateStage, 'idle'>) {
    setStage(next)
    const step = next === 'seeding' ? 1 : 2
    const total = 2
    toast.loading(STAGE_LABEL[next], {
      id: TEST_SUITE_TOAST_ID,
      description: `Step ${step} of ${total}`,
      duration: Infinity,
    })
  }

  async function handlePopulate() {
    if (disabled) return

    showStageProgress('seeding')
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
        toast.error(body.error ?? 'Could not populate test suite', { id: TEST_SUITE_TOAST_ID })
        return
      }

      const skipped =
        body.skippedForCapacity && body.skippedForCapacity > 0
          ? ` (${body.skippedForCapacity} skipped at category caps)`
          : ''

      const populateOnCanvas =
        populateTestSuiteOnCanvasProp ?? market?.populateTestSuiteOnCanvas

      if (!populateOnCanvas) {
        await market?.refreshApprovedPool(eventId)
        router.refresh()
        toast.success(
          `Test suite ready: ${body.applicationCount ?? 0} approved & paid vendors (${body.tableSlots ?? 0} tables)${skipped}. Open HubGrid to place booths on the grid.`,
          { id: TEST_SUITE_TOAST_ID, duration: 9000 }
        )
        return
      }

      showStageProgress('assigning')
      const layout = await populateOnCanvas(eventId)

      const vendorLine = `${body.applicationCount ?? 0} approved & paid vendors (${body.tableSlots ?? 0} tables)${skipped}`
      const tableTarget = layout.boothsRequested || canvasVendorBoothCount

      if (layout.error && layout.boothsAssigned <= 0) {
        toast.warning(
          `Test suite seeded ${vendorLine}, but booths were not assigned. ${layout.error}`,
          { id: TEST_SUITE_TOAST_ID, duration: 10000 }
        )
        return
      }

      if (layout.boothsAssigned < tableTarget) {
        const assignNote =
          layout.boothsAssigned > 0
            ? ` Assigned ${layout.boothsAssigned} of ${tableTarget} canvas booths.`
            : ''
        toast.warning(
          `Test suite seeded ${vendorLine}.${assignNote} Add more vendor booths on the canvas or reduce seeded table counts.`,
          { id: TEST_SUITE_TOAST_ID, duration: 12000 }
        )
        return
      }

      toast.success(
        `Test suite ready: ${vendorLine}. All ${layout.boothsAssigned} canvas booths assigned.`,
        { id: TEST_SUITE_TOAST_ID, duration: 10000 }
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not populate test suite'
      toast.error(message, { id: TEST_SUITE_TOAST_ID })
    } finally {
      setStage('idle')
    }
  }

  const disabledTitle = disabledForEmptyCanvas
    ? 'Place at least one vendor booth on the canvas before populating the test suite'
    : 'Seed approved paid vendors and assign them to every vendor booth on the canvas'

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={disabled}
        onClick={() => void handlePopulate()}
        className={cn(
          'shrink-0 gap-1.5 border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100',
          compact ? 'h-8 px-2.5 text-xs' : 'h-9',
          disabledForEmptyCanvas && 'opacity-60'
        )}
        title={disabledTitle}
      >
        <FlaskConical className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} aria-hidden />
        {running
          ? STAGE_LABEL[stage as Exclude<PopulateStage, 'idle'>]
          : compact
            ? 'Test suite'
            : 'Populate test suite'}
      </Button>
      {running ? (
        <Progress value={STAGE_PROGRESS[stage]} className="w-full min-w-[8rem]" />
      ) : null}
    </div>
  )
}
