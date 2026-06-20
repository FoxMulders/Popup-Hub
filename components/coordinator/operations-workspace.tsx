'use client'

import { FCFSQueue } from '@/components/coordinator/fcfs-queue'
import { MarketOpsPanel } from '@/components/coordinator/market-ops-panel'
import { BoothClearanceList } from '@/components/coordinator/booth-clearance-list'
import { MarketDayGuide } from '@/components/coordinator/market-day-guide'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ClipboardList, ListOrdered, CheckSquare, BookOpen } from 'lucide-react'
import type {
  BoothApplication,
  BoothCell,
  BoothClearancePolicy,
  Profile,
  VendorPassport,
} from '@/types/database'

export type OperationsApplication = Omit<BoothApplication, 'vendor' | 'passport' | 'category'> & {
  vendor: Profile
  passport: VendorPassport | null
  category: { name: string } | null
}

interface OperationsWorkspaceProps {
  eventId: string
  applications: OperationsApplication[]
  boothCells: BoothCell[]
  raffleDonationRequirement: string | null
  boothClearancePolicy: BoothClearancePolicy
}

export function OperationsWorkspace({
  eventId,
  applications,
  boothCells,
  raffleDonationRequirement,
  boothClearancePolicy,
}: OperationsWorkspaceProps) {
  const fcfsApplications = applications.map((application) => ({
    id: application.id,
    vendor_id: application.vendor_id,
    applied_at: application.applied_at,
    booth_number: application.booth_number,
    requested_booth_type: application.requested_booth_type,
    neighbor_preference: application.neighbor_preference,
    vendor: {
      full_name: application.vendor.full_name,
      is_beta_tester: application.vendor.is_beta_tester,
    },
    passport: application.passport ? { business_name: application.passport.business_name } : null,
  }))

  return (
    <Tabs defaultValue="guide" className="space-y-4">
      <div className="-mx-1 overflow-x-auto pb-1">
        <TabsList className="market-card inline-flex h-auto w-max min-w-full flex-nowrap justify-start gap-1 p-1 bg-card/90">
          <TabsTrigger
            value="guide"
            className="min-h-11 shrink-0 gap-1.5 rounded-lg px-3 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground"
          >
            <BookOpen className="h-4 w-4" />
            How to Use & FAQ
          </TabsTrigger>
          <TabsTrigger
            value="operations"
            className="min-h-11 shrink-0 gap-1.5 rounded-lg px-3 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground"
          >
            <ClipboardList className="h-4 w-4" />
            Live Operations Grid
          </TabsTrigger>
          <TabsTrigger
            value="fcfs"
            className="min-h-11 shrink-0 gap-1.5 rounded-lg px-3 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground"
          >
            <ListOrdered className="h-4 w-4" />
            FCFS Queue
          </TabsTrigger>
          <TabsTrigger
            value="clearance"
            className="min-h-11 shrink-0 gap-1.5 rounded-lg px-3 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground"
          >
            <CheckSquare className="h-4 w-4" />
            Fraud-Proof Checkout
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="guide" className="mt-0">
        <article>
          <MarketDayGuide />
        </article>
      </TabsContent>

      <TabsContent value="operations" className="mt-0">
        <article aria-label="Live operations grid">
          <MarketOpsPanel
            eventId={eventId}
            applications={applications}
            raffleDonationRequirement={raffleDonationRequirement}
          />
        </article>
      </TabsContent>

      <TabsContent value="fcfs" className="mt-0">
        <article aria-label="FCFS vendor queue">
          <div className="market-card p-4 mb-4 text-sm text-sage-800 bg-sage-50/50">
            Vendors are ordered by application approval time. Matching &quot;Stand Beside&quot;
            preferences are highlighted — use HubGrid to place paired vendors in adjacent
            booths when chronologically viable.
          </div>
          <FCFSQueue applications={fcfsApplications} boothCells={boothCells} />
        </article>
      </TabsContent>

      <TabsContent value="clearance" className="mt-0">
        <article aria-label="Fraud-proof booth checkout">
          <div className="market-card p-4 mb-4 text-sm text-harvest-900 bg-harvest-50/60 border-harvest-200/80">
            Host-provided venue tables and chairs must be left in place. All personal inventory,
            displays, and trash must be removed. Checkout photos use the device camera only, with a
            permanent UTC watermark.
          </div>
          <BoothClearanceList
            eventId={eventId}
            clearancePolicy={boothClearancePolicy}
            applications={applications}
          />
        </article>
      </TabsContent>
    </Tabs>
  )
}
