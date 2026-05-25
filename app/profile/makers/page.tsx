import Link from 'next/link'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { ArrowLeft, ExternalLink, MapPin } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { getPatronMakersDirectory } from '@/lib/patron/makers-directory'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default async function MakersIMetPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/profile/makers')

  const makers = await getPatronMakersDirectory(supabase, user.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Profile
      </Link>

      <div>
        <h1 className="text-3xl font-bold text-foreground">Makers I Met</h1>
        <p className="mt-1 text-muted-foreground">
          Vendors you discovered by scanning passports at markets.
        </p>
      </div>

      {makers.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center space-y-3">
          <p className="text-muted-foreground">No passport scans yet.</p>
          <p className="text-sm text-muted-foreground">
            Check in at a market, then scan vendor QR codes to build your directory.
          </p>
          <Link href="/discover" className={cn(buttonVariants({ variant: 'outline' }), 'inline-flex')}>
            Browse markets
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {makers.map((maker) => {
            const initials = maker.businessName
              .split(' ')
              .map((part) => part[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)

            return (
              <li
                key={maker.vendorId}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={maker.logoUrl ?? undefined} alt={maker.businessName} />
                    <AvatarFallback className="bg-harvest-100 text-harvest-700 text-sm font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-foreground truncate">
                        {maker.businessName}
                      </h2>
                      {maker.categoryName ? (
                        <Badge variant="outline" className="text-[10px]">
                          {maker.categoryName}
                        </Badge>
                      ) : null}
                    </div>
                    {maker.bio ? (
                      <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                        {maker.bio}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      Last met at {maker.latestEventName} ·{' '}
                      {format(new Date(maker.lastScannedAt), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {maker.marketCount} market{maker.marketCount === 1 ? '' : 's'} ·{' '}
                      {maker.scanCount} scan{maker.scanCount === 1 ? '' : 's'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={maker.profileHref} className={cn(buttonVariants({ size: 'sm' }), 'inline-flex')}>
                    View at market
                  </Link>
                  {maker.websiteUrl ? (
                    <a
                      href={maker.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex')}
                    >
                      Website
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  ) : null}
                  {maker.shopUrl ? (
                    <a
                      href={maker.shopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }), 'inline-flex')}
                    >
                      Shop
                      <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
