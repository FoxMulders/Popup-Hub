import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MarketOpsPanel } from '@/components/coordinator/market-ops-panel'
import { FCFSQueue } from '@/components/coordinator/fcfs-queue'
import { BoothClearanceList } from '@/components/coordinator/booth-clearance-list'
import { MarketDayShell } from '@/components/coordinator/market-day-shell'
import { MarketDayGuide } from '@/components/coordinator/market-day-guide'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { ClipboardList, ListOrdered, CheckSquare, BookOpen } from 'lucide-react'
import type { BoothApplication, BoothClearancePolicy, Profile, VendorPassport, BoothCell } from '@/types/database'

interface Props {
  params: Promise<{ id: string }>
}

type OpsApp = Omit<BoothApplication, 'vendor' | 'passport' | 'category'> & {
  vendor: Profile
  passport: VendorPassport | null
  category: { name: string } | null
}

function normalizeApp(a: Record<string, unknown>): OpsApp {
  const base = a as unknown as BoothApplication
  return {
    ...base,
    vendor: (Array.isArray(a.vendor) ? a.vendor[0] : a.vendor) as Profile,
    passport: (Array.isArray(a.passport) ? (a.passport[0] ?? null) : (a.passport ?? null)) as VendorPassport | null,
    category: (Array.isArray(a.category) ? (a.category[0] ?? null) : (a.category ?? null)) as { name: string } | null,
  }
}

export default async function OperationsPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: event } = await supabase
    .from('events')
    .select('id, name, coordinator_id, booth_clearance_policy, status, raffle_donation_requirement')
    .eq('id', id)
    .eq('coordinator_id', user.id)
    .single()

  if (!event) notFound()
  if (event.status === 'cancelled') {
    redirect(`/coordinator/events/${id}`)
  }

  const { data: rawApplications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      vendor:profiles(
        id, full_name, email, phone, avatar_url, role, created_at,
        reliability_score, total_markets, no_show_count, left_early_count,
        late_arrival_count, poor_cleanup_strike_count
      ),
      passport:vendor_passports(id, user_id, business_name, bio, logo_url, item_image_urls, is_verified, created_at, primary_category_id, tax_id_encrypted),
      category:categories(name)
    `)
    .eq('event_id', id)
    .eq('status', 'approved')
    .order('booth_number', { ascending: true, nullsFirst: false })

  const applications: OpsApp[] = (rawApplications ?? []).map((a) =>
    normalizeApp(a as Record<string, unknown>)
  )

  const { data: layoutRow } = await supabase
    .from('booth_layouts')
    .select('cells')
    .eq('event_id', id)
    .maybeSingle()

  const boothCells: BoothCell[] = (layoutRow?.cells as BoothCell[] | null) ?? []

  return (
    <MarketDayShell eventId={id} eventName={event.name} activeSection="operations">
      <Tabs defaultValue="guide" className="space-y-4">
        <aside aria-label="Market day sections">
          <TabsList className="market-card h-auto w-full flex-wrap justify-start gap-1 p-1 bg-card/90 scroll-touch-x">
          <TabsTrigger value="guide" className="gap-1.5 rounded-lg min-h-11 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground">
            <BookOpen className="h-4 w-4" />
            How to Use & FAQ
          </TabsTrigger>
          <TabsTrigger value="operations" className="gap-1.5 rounded-lg min-h-11 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground">
            <ClipboardList className="h-4 w-4" />
            Live Operations Grid
          </TabsTrigger>
          <TabsTrigger value="fcfs" className="gap-1.5 rounded-lg min-h-11 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground">
            <ListOrdered className="h-4 w-4" />
            FCFS Queue
          </TabsTrigger>
          <TabsTrigger value="clearance" className="gap-1.5 rounded-lg min-h-11 data-[state=active]:bg-forest data-[state=active]:text-primary-foreground">
            <CheckSquare className="h-4 w-4" />
            Fraud-Proof Checkout
          </TabsTrigger>
        </TabsList>
        </aside>

        <TabsContent value="guide" className="mt-0">
          <article>
            <MarketDayGuide />
          </article>
        </TabsContent>

        <TabsContent value="operations" className="mt-0">
          <article aria-label="Live operations grid">
          <MarketOpsPanel
            eventId={id}
            applications={applications}
            raffleDonationRequirement={event.raffle_donation_requirement}
          />
          </article>
        </TabsContent>

        <TabsContent value="fcfs" className="mt-0">
          <article aria-label="FCFS vendor queue">
          <div className="market-card p-4 mb-4 text-sm text-sage-800 bg-sage-50/50">
            Vendors are ordered by application approval time. Matching &quot;Stand Beside&quot; preferences
            are highlighted — use the spatial planner to snap booths together when chronologically viable.
          </div>
          <FCFSQueue
            applications={applications.map((a) => ({
              id: a.id,
              vendor_id: a.vendor_id,
              applied_at: a.applied_at,
              booth_number: a.booth_number,
              requested_booth_type: a.requested_booth_type,
              neighbor_preference: a.neighbor_preference,
              vendor: { full_name: a.vendor.full_name },
              passport: a.passport ? { business_name: a.passport.business_name } : null,
            }))}
            boothCells={boothCells}
            onAssign={() => {}}
          />
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
            eventId={id}
            clearancePolicy={(event.booth_clearance_policy as BoothClearancePolicy) ?? 'leave_furniture'}
            applications={applications}
          />
          </article>
        </TabsContent>
      </Tabs>
    </MarketDayShell>
  )
}
