import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { format } from 'date-fns'
import { Store, Calendar, CheckCircle, Clock, AlertTriangle, ArrowRight } from 'lucide-react'
import type { BoothApplication } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pending Review', class: 'bg-yellow-100 text-yellow-700' },
  approved: { label: 'Approved', class: 'bg-green-100 text-green-700' },
  rejected: { label: 'Declined', class: 'bg-red-100 text-red-600' },
  waitlisted: { label: 'Waitlisted', class: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', class: 'bg-gray-100 text-gray-500' },
}

async function ApplicationsSection({ userId }: { userId: string }) {
  const supabase = await createClient()
  const { data: applications } = await supabase
    .from('booth_applications')
    .select(`
      *,
      event:events(name, location_name, start_at, end_at, status),
      category:categories(name)
    `)
    .eq('vendor_id', userId)
    .order('applied_at', { ascending: false })
    .limit(10)

  if (!applications || applications.length === 0) {
    return (
      <div className="rounded-2xl border bg-white py-12 text-center">
        <Calendar className="mx-auto mb-3 h-8 w-8 text-gray-300" />
        <p className="text-gray-500 text-sm">No applications yet.</p>
        <Link href="/vendor/events">
          <Button size="sm" className="mt-4 bg-amber-500 hover:bg-amber-600 text-white">
            Browse Open Markets
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {(applications as BoothApplication[]).map((app) => {
        const config = STATUS_CONFIG[app.status]
        return (
          <div
            key={app.id}
            className="flex items-center justify-between rounded-xl border bg-white p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-gray-900 text-sm">
                {app.event?.name}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">
                  {app.event?.start_at
                    ? format(new Date(app.event.start_at), 'MMM d, yyyy')
                    : ''}
                </span>
                <Badge className={`text-[10px] ${config.class}`}>{config.label}</Badge>
                {app.category && (
                  <Badge variant="outline" className="text-[10px]">
                    {app.category.name}
                  </Badge>
                )}
              </div>
            </div>
            {app.waitlist_position && (
              <span className="text-xs text-blue-600 font-medium ml-2">
                #{app.waitlist_position} in queue
              </span>
            )}
          </div>
        )
      })}
    </div>
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
            Browse Markets
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
