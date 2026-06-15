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

type PopulateStage = 'idle' | 'seeding' | 'placing' | 'assigning'

const STAGE_PROGRESS: Record<Exclude<PopulateStage, 'idle'>, number> = {
  seeding: 35,
  placing: 70,
  assigning: 90,
}

const STAGE_LABEL: Record<Exclude<PopulateStage, 'idle'>, string> = {
  seeding: 'Seeding vendors…',
  placing: 'Placing booths on grid…',
  assigning: 'Assigning vendors to booths…',
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
  /** Setup wizard / spatial editor — populate booths on the live canvas without router.refresh(). */
  populateTestSuiteOnCanvas?: (eventId: string) => Promise<TestSuitePopulateResult>
}

export function TestSuitePopulateButton({
  eventId,
  compact = false,
  className,
  populateTestSuiteOnCanvas: populateTestSuiteOnCanvasProp,
}: TestSuitePopulateButtonProps) {
  const router = useRouter()
  const market = useOptionalMarketManagement()
  const [stage, setStage] = useState<PopulateStage>('idle')
  const running = stage !== 'idle'

  function showStageProgress(next: Exclude<PopulateStage, 'idle'>) {
    setStage(next)
    toast.loading(STAGE_LABEL[next], {
      id: TEST_SUITE_TOAST_ID,
      description: `Step ${next === 'seeding' ? 1 : next === 'placing' ? 2 : 3} of 3`,
      duration: Infinity,
    })
  }

  async function handlePopulate() {
    if (running) return

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
          `Test suite ready: ${body.applicationCount ?? 0} approved & paid vendors (${body.tableSlots ?? 0} tables)${skipped}. Open Blueprint Studio to place booths on the grid.`,
          { id: TEST_SUITE_TOAST_ID, duration: 9000 }
        )
        return
      }

      showStageProgress('placing')
      const layout = await populateOnCanvas(eventId)
      showStageProgress('assigning')

      const vendorLine = `${body.applicationCount ?? 0} approved & paid vendors (${body.tableSlots ?? 0} tables)${skipped}`
      const tableTarget = body.tableSlots ?? layout.tableSlots

      if (layout.boothsFilled <= 0) {
        toast.warning(
          `Test suite seeded ${vendorLine}, but no booths were placed on the grid. ${layout.error ?? 'Open Blueprint Studio with Main Hall visible and try again.'}`,
          { id: TEST_SUITE_TOAST_ID, duration: 10000 }
        )
        return
      }

      if (layout.boothsFilled < tableTarget) {
        const assignNote =
          layout.boothsAssigned < layout.boothsFilled
            ? ` Assigned ${layout.boothsAssigned} of ${layout.boothsFilled} placed booths.`
            : ` All ${layout.boothsAssigned} booths assigned.`
        toast.warning(
          `Test suite seeded ${vendorLine}. Grid: placed ${layout.boothsFilled} of ${tableTarget} vendor booths — expand ${layout.roomName ?? 'the room'} or reduce table size.${assignNote}`,
          { id: TEST_SUITE_TOAST_ID, duration: 12000 }
        )
        return
      }

      const assignNote =
        layout.boothsAssigned < layout.boothsFilled
          ? ` ${layout.boothsAssigned} of ${layout.boothsFilled} booths assigned (room full).`
          : ` All ${layout.boothsAssigned} booths assigned.`

      toast.success(
        `Test suite ready: ${vendorLine}. Grid: ${layout.boothsFilled} vendor booths placed.${assignNote}`,
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

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={running}
        onClick={() => void handlePopulate()}
        className={cn(
          'shrink-0 gap-1.5 border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100',
          compact ? 'h-8 px-2.5 text-xs' : 'h-9'
        )}
        title="Seed approved paid vendors to market capacity, fill the room grid, and assign booths for allocation QA"
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
