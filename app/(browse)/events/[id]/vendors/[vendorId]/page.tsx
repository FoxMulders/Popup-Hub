import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Globe, ShoppingBag } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { VendorLogo } from '@/components/vendor/vendor-logo'
import { VendorFollowButton } from '@/components/shopper/vendor-follow-button'
import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { patronEventMapUrl } from '@/lib/shopper/public-floorplan-modes'
import { getVendorLinks } from '@/lib/shopper/vendors'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'
import { buildVendorProfileHref } from '@/lib/shopper/vendors'
import { JsonLdScript } from '@/components/seo/json-ld-script'
import { buildBreadcrumbJsonLd } from '@/lib/seo/breadcrumb-json-ld'
import { buildVendorProfileJsonLd } from '@/lib/seo/vendor-profile-json-ld'

interface Props {
  params: Promise<{ id: string; vendorId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id, vendorId } = await params
  const supabase = await createClient()
  const { data: app } = await supabase
    .from('booth_applications')
    .select(`
      passport:vendor_passports(business_name, bio, logo_url),
      category:categories(name),
      event:events(name)
    `)
    .eq('event_id', id)
    .eq('vendor_id', vendorId)
    .eq('status', 'approved')
    .maybeSingle()

  const passport = Array.isArray(app?.passport) ? app.passport[0] : app?.passport
  const event = Array.isArray(app?.event) ? app.event[0] : app?.event
  const category = Array.isArray(app?.category) ? app.category[0] : app?.category
  const passportData = passport as {
    business_name?: string | null
    bio?: string | null
    logo_url?: string | null
  } | null | undefined
  const eventName = (event as { name?: string } | null | undefined)?.name?.trim()
  const categoryName = (category as { name?: string } | null | undefined)?.name?.trim()
  const name = passportData?.business_name?.trim() ?? 'Vendor'
  const bio = passportData?.bio?.trim()
  const description =
    bio?.slice(0, 160) ||
    (eventName && categoryName
      ? `Visit ${name} at ${eventName} — ${categoryName}.`
      : eventName
        ? `Visit ${name} at ${eventName} on Popup Hub.`
        : `Visit ${name} at this market on Popup Hub.`)

  return buildPublicMetadata({
    title: name,
    description,
    path: buildVendorProfileHref(id, vendorId),
    imageUrl: passportData?.logo_url,
  })
}

export default async function PublicVendorProfilePage({ params }: Props) {
  const { id: eventId, vendorId } = await params
  const supabase = await createClient()

  const [{ data: event }, { data: application }, { data: auth }] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, status')
      .eq('id', eventId)
      .in('status', ['published', 'active', 'completed'])
      .maybeSingle(),
    supabase
      .from('booth_applications')
      .select(`
        id,
        booth_number,
        vendor_id,
        passport:vendor_passports(
          business_name,
          bio,
          logo_url,
          website_url,
          shop_url,
          instagram_url,
          tiktok_url,
          facebook_url,
          is_verified
        ),
        category:categories(name),
        vendor:profiles!booth_applications_vendor_id_fkey(full_name, avatar_url)
      `)
      .eq('event_id', eventId)
      .eq('vendor_id', vendorId)
      .eq('status', 'approved')
      .maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!event || !application) notFound()

  const passport = Array.isArray(application.passport)
    ? application.passport[0]
    : application.passport
  const vendor = Array.isArray(application.vendor) ? application.vendor[0] : application.vendor
  const category = Array.isArray(application.category) ? application.category[0] : application.category
  const businessName =
    passport?.business_name?.trim() ?? vendor?.full_name?.trim() ?? 'Vendor'
  const links = getVendorLinks(passport)
  const mapHref =
    application.booth_number != null
      ? patronEventMapUrl(eventId, application.booth_number)
      : patronEventMapUrl(eventId)
  const initials = businessName
    .split(' ')
    .map((part: string) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  let initialFollowing = false
  if (auth.user) {
    const { data: follow } = await supabase
      .from('vendor_follows')
      .select('vendor_id')
      .eq('user_id', auth.user.id)
      .eq('vendor_id', vendorId)
      .maybeSingle()
    initialFollowing = Boolean(follow)
  }

  return (
    <>
      <JsonLdScript
        data={[
          buildBreadcrumbJsonLd([
            { name: 'Home', path: '/' },
            { name: 'Discover Markets', path: '/discover' },
            { name: event.name, path: `/events/${eventId}` },
            { name: businessName, path: buildVendorProfileHref(eventId, vendorId) },
          ]),
          buildVendorProfileJsonLd({
            eventId,
            vendorId,
            businessName,
            description: passport?.bio,
            logoUrl: passport?.logo_url ?? vendor?.avatar_url,
            categoryName: category?.name,
            eventName: event.name,
            websiteUrl: passport?.website_url,
            shopUrl: passport?.shop_url,
            instagramUrl: passport?.instagram_url,
          }),
        ]}
      />
      <main className="mx-auto max-w-lg px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {event.name}
      </p>
      <div className="mt-4 space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
        <PassportStoriesPublicStrip
          ownerId={vendorId}
          displayName={businessName}
          avatarUrl={passport?.logo_url ?? vendor?.avatar_url ?? null}
        />

        <div className="flex items-start gap-4">
          <VendorLogo
            src={passport?.logo_url ?? vendor?.avatar_url}
            alt={`${businessName} logo`}
            fallback={initials}
            size="lg"
          />
          <div className="min-w-0 space-y-1">
            <h1 className="font-heading text-2xl font-semibold text-foreground">{businessName}</h1>
            {category?.name ? (
              <Badge variant="outline" className="text-[10px]">
                {category.name}
              </Badge>
            ) : null}
            {application.booth_number != null ? (
              <p className="text-sm text-muted-foreground">Booth {application.booth_number}</p>
            ) : null}
          </div>
        </div>

        {passport?.bio ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{passport.bio}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Link href={mapHref} className={buttonVariants()}>
            <MapPin className="mr-1.5 h-4 w-4" />
            View on map
          </Link>
          <VendorFollowButton vendorId={vendorId} initialFollowing={initialFollowing} />
        </div>

        {links.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Shop & social
            </p>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                    {link.field === 'shop_url' ? (
                      <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                    ) : (
                      <Globe className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    {link.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <p className="text-center text-xs text-muted-foreground">
          <Link href={`/events/${eventId}`} className="underline underline-offset-2">
            Back to market lineup
          </Link>
        </p>
      </div>
    </main>
    </>
  )
}
