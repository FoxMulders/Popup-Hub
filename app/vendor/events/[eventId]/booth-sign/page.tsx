import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { extractNestedPassport } from '@/lib/applications/extract-nested-passport'
import { isBoothSignEligible } from '@/lib/vendor/booth-sign'
import { buildBoothSignProfileUrl } from '@/lib/vendor/booth-sign'
import { getRequestPublicOrigin } from '@/lib/url/public-app-url'
import { VendorBoothSignPoster } from '@/components/vendor/vendor-booth-sign-poster'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function VendorBoothSignPage({ params }: Props) {
  const { eventId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/vendor/events/${eventId}/booth-sign`)

  const [{ data: event }, { data: application }] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, status')
      .eq('id', eventId)
      .maybeSingle(),
    supabase
      .from('booth_applications')
      .select(`
        id,
        booth_number,
        status,
        payment_status,
        application_payment_status,
        payment_method,
        passport:vendor_passports(business_name, logo_url),
        category:categories(name)
      `)
      .eq('event_id', eventId)
      .eq('vendor_id', user.id)
      .maybeSingle(),
  ])

  if (!event || !application) notFound()
  if (!isBoothSignEligible(application)) {
    redirect('/vendor/applications')
  }

  const passport = extractNestedPassport(application)
  const category = Array.isArray(application.category)
    ? application.category[0]
    : application.category
  const origin = await getRequestPublicOrigin()
  const profileUrl = buildBoothSignProfileUrl(eventId, user.id, origin)

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:p-0">
      <div className="mb-6 print:hidden">
        <h1 className="font-heading text-xl font-semibold">Booth sign</h1>
        <p className="text-sm text-muted-foreground">
          Print this sign and place it on your table. Patrons can scan to open your profile on the
          market map.
        </p>
      </div>
      <VendorBoothSignPoster
        profileUrl={profileUrl}
        eventName={event.name ?? 'Market'}
        businessName={passport?.business_name ?? 'My booth'}
        boothNumber={application.booth_number}
        logoUrl={passport?.logo_url}
        categoryName={category?.name ?? null}
      />
    </main>
  )
}
