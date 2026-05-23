import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Store, Calendar, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import { VendorApplicationsList } from '@/components/vendor/vendor-applications-list'
import type { BoothApplication } from '@/types/database'

async function ApplicationsSection({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      event:events(
        id,
        name, location_name, start_at, end_at, status,
        cancellation_reason, cancellation_reason_notes
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
    />
  )
}

export default async function VendorDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: passport }, { count: approvedCount }, { count: pendingCount }] =
    await Promise.all([
      supabase
        .from('vendor_passports')
        .select('id, business_name, is_verified')
        .eq('user_id', user.id)
        .maybeSingle(),
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
    ])

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Vendor Dashboard</h1>
          <p className="mt-1 text-gray-500">Manage your bookings and passport</p>
        </div>
        <Link href="/vendor/events">
          <Button className="bg-amber-500 hover:bg-amber-600 text-white">
            Apply for open markets
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Passport Status</CardTitle>
          </CardHeader>
          <CardContent>
            {passport ? (
              <div className="flex items-center gap-2">
                <Store className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold">{passport.business_name}</p>
                  <Badge className={`text-[10px] ${passport.is_verified ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                    {passport.is_verified ? '✓ Verified' : 'Unverified'}
                  </Badge>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-gray-700">Not created</p>
                  <Link href="/vendor/passport">
                    <Button size="sm" variant="link" className="h-auto p-0 text-xs text-amber-600">
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
            <CardTitle className="text-sm font-medium text-gray-500">Confirmed Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{approvedCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <span className="text-2xl font-bold">{pendingCount ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Applications list */}
      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-900">Recent Applications</h2>
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
