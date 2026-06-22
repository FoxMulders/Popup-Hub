import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PageIntro } from '@/components/layout/page-intro'
import Link from 'next/link'
import { ArrowRight, Store, CheckCircle, Clock, AlertTriangle, CreditCard } from 'lucide-react'
import { VendorApplicationsList } from '@/components/vendor/vendor-applications-list'
import { VendorAlertOnboarding } from '@/components/vendor/vendor-alert-onboarding'
import { VendorActionRequiredBanner } from '@/components/vendor/vendor-action-required-banner'
import { VendorApplicationStatusBanner } from '@/components/vendor/vendor-application-status-banner'
import { fetchUnreadVendorApplicationStatusNotifications } from '@/lib/vendor/fetch-application-status-notifications'
import { VendorPassportCompletionCard } from '@/components/vendor/vendor-passport-completion-card'
import { vendorPassportCompletionMeter } from '@/lib/passport/vendor-passport-completion'
import { VendorMeetTheMakerPanel } from '@/components/market-feed/vendor-meet-the-maker-panel'
import { PassportStoriesManager } from '@/components/passport/passport-stories-manager'
import { LiveAuctionBanner } from '@/components/auction/live-auction-banner'
import { summarizeEventAuctions } from '@/lib/auction/event-auctions'
import type { Auction, BoothApplication } from '@/types/database'

async function ApplicationsSection({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      event:events(
        id,
        name, location_name, start_at, end_at, status, booking_mode,
        cancellation_reason, cancellation_reason_notes,
        coordinator:profiles!events_coordinator_id_fkey(id, full_name, email, avatar_url)
      ),
      category:categories(name)
    `)
    .eq('vendor_id', userId)
    .order('applied_at', { ascending: false })
    .limit(10)

  const eventIds = [...new Set((applications ?? []).map((a) => a.event_id))]
  const categoryPrices: Record<string, number> = {}

  if (eventIds.length > 0) {
    const { data: limits } = await supabase
      .from('event_category_limits')
      .select('event_id, category_id, price_per_booth')
      .in('event_id', eventIds)

    for (const limit of limits ?? []) {
      categoryPrices[`${limit.event_id}:${limit.category_id}`] = limit.price_per_booth
    }
  }

  return (
    <VendorApplicationsList
      applications={(applications ?? []) as BoothApplication[]}
      categoryPrices={categoryPrices}
      userId={userId}
      showFilters={false}
    />
  )
}

export default async function VendorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: passport }, { data: profile }, { count: approvedCount }, { count: pendingCount }, { count: pendingInsuranceCount }, { data: approvedApps }, { data: wallet }, { data: paymentDueApps }] =
    await Promise.all([
      supabase
        .from('vendor_passports')
        .select('id, business_name, is_verified, primary_category_id, category_ids, logo_url, bio')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
      supabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .eq('status', 'approved'),
      supabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .eq('status', 'pending'),
      supabase
        .from('booth_applications')
        .select('id', { count: 'exact', head: true })
        .eq('vendor_id', user.id)
        .eq('status', 'pending_insurance'),
      supabase
        .from('booth_applications')
        .select('event_id')
        .eq('vendor_id', user.id)
        .eq('status', 'approved'),
      supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
      supabase
        .from('booth_applications')
        .select('id')
        .eq('vendor_id', user.id)
        .eq('status', 'approved')
        .eq('payment_status', 'payment_required'),
    ])

  const paymentDueCount = paymentDueApps?.length ?? 0
  const awaitingReviewCount = (pendingCount ?? 0) + (pendingInsuranceCount ?? 0)
  const passportMeter = vendorPassportCompletionMeter(passport, profile?.full_name ?? null)
  const statusNotifications = await fetchUnreadVendorApplicationStatusNotifications(
    supabase,
    user.id
  )

  const approvedEventIds = [...new Set((approvedApps ?? []).map((a) => a.event_id))]
  let liveAuctionSummary = { active: null as Auction | null, upcoming: null as Auction | null, lastEnded: null as Auction | null }

  if (approvedEventIds.length > 0) {
    const { data: eventAuctions } = await supabase
      .from('auctions')
      .select('*')
      .in('event_id', approvedEventIds)
      .in('status', ['upcoming', 'active', 'ended'])
      .order('created_at', { ascending: false })

    liveAuctionSummary = summarizeEventAuctions((eventAuctions ?? []) as Auction[])
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageIntro
        eyebrow="Vendor portal"
        title="Dashboard"
        description="Manage your passport, applications, and bookings"
        actions={
          <Link href="/vendor/events">
            <Button size="pill">
              Apply for open markets
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
          </Link>
        }
      />

      <VendorAlertOnboarding />

      <VendorPassportCompletionCard
        meter={passportMeter}
        businessName={passport?.business_name ?? profile?.full_name ?? null}
      />

      <VendorActionRequiredBanner
        pendingInsuranceCount={pendingInsuranceCount ?? 0}
        paymentDueCount={paymentDueCount}
      />

      <VendorApplicationStatusBanner notifications={statusNotifications} />

      {(liveAuctionSummary.active || liveAuctionSummary.upcoming) && (
        <LiveAuctionBanner
          activeAuction={liveAuctionSummary.active}
          upcomingAuction={liveAuctionSummary.upcoming}
          lastEndedAuction={null}
          walletBalanceCents={wallet?.balance ?? 0}
        />
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Passport Status</CardTitle>
          </CardHeader>
          <CardContent>
            {passport ? (
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-harvest-500" />
                <div>
                  <p className="text-sm font-semibold">{passport.business_name}</p>
                  <Badge className={`text-[10px] ${passport.is_verified ? 'bg-blue-100 text-blue-700' : 'bg-stone-100 text-muted-foreground'}`}>
                    {passport.is_verified ? '✓ Verified' : 'Unverified'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-harvest-500" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Not created</p>
                  <Link href="/vendor/passport">
                    <Button size="sm" variant="link" className="h-auto p-0 text-xs text-harvest-600">
                      Create now →
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Confirmed Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{approvedCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Link href="/vendor/applications?filter=pending">
          <Card className="h-full transition-colors hover:border-harvest-300 hover:bg-harvest-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Review</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{awaitingReviewCount}</span>
              </div>
              {awaitingReviewCount > 0 ? (
                <p className="mt-1 text-xs font-medium text-harvest-700">View applications →</p>
              ) : null}
            </CardContent>
          </Card>
        </Link>

        <Card className={paymentDueCount > 0 ? 'border-harvest-200 bg-harvest-50/40' : undefined}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Payment Due</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CreditCard className={`h-5 w-5 ${paymentDueCount > 0 ? 'text-harvest-600' : 'text-muted-foreground'}`} />
              <span className="text-2xl font-bold">{paymentDueCount}</span>
            </div>
            {paymentDueCount > 0 ? (
              <Link href="/vendor/applications">
                <Button size="sm" variant="link" className="h-auto p-0 text-xs text-harvest-700">
                  Pay now →
                </Button>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Passport stories</h2>
          <Link href="/vendor/passport">
            <Button variant="link" size="sm" className="h-auto p-0 text-sm">
              Full passport →
            </Button>
          </Link>
        </div>
        <PassportStoriesManager ownerId={user.id} role="vendor" />
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-foreground">Meet the Maker — Live Feed</h2>
        <VendorMeetTheMakerPanel vendorId={user.id} />
      </div>

      {/* Applications list */}
      <div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-foreground">Recent Applications</h2>
          <Link href="/vendor/applications">
            <Button variant="link" size="sm" className="h-auto p-0 text-sm">
              View all →
            </Button>
          </Link>
        </div>
        <Suspense
          fallback={
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          }
        >
          <ApplicationsSection userId={user.id} />
        </Suspense>
      </div>
    </div>
  )
}
