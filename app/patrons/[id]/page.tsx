import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveProfileAvatarForServer } from '@/lib/profile/server-avatar'
import { loadPublicPassportIndex } from '@/lib/passport/public-passport-index'
import { PassportPublicCard } from '@/components/passport/passport-public-card'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'
import { buildPublicMetadata } from '@/lib/seo/public-metadata'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url')
    .eq('id', id)
    .eq('role', 'shopper')
    .maybeSingle()

  if (!profile) {
    return buildPublicMetadata({
      title: 'Patron not found — Popup Hub',
      description: 'This patron profile is unavailable.',
      path: `/patrons/${id}`,
    })
  }

  return buildPublicMetadata({
    title: `${profile.full_name} — Popup Hub Patron`,
    description: `Browse ${profile.full_name}'s market passport and story highlights on Popup Hub.`,
    path: `/patrons/${id}`,
    imageUrl: profile.avatar_url,
  })
}

export default async function PatronPublicProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const service = await createServiceClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, created_at')
    .eq('id', id)
    .eq('role', 'shopper')
    .single()

  if (!profile) notFound()

  const [displayAvatarUrl, publicPassport] = await Promise.all([
    resolveProfileAvatarForServer(supabase, profile),
    loadPublicPassportIndex(service, id),
  ])

  const displayName = publicPassport?.businessName?.trim() || profile.full_name

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8">
      <nav aria-label="Breadcrumb">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </nav>

      <article className="space-y-8">

      <PassportPublicCard
        displayName={displayName}
        avatarUrl={displayAvatarUrl}
        passport={publicPassport}
        subtitle={`Market Patron · Member since ${format(new Date(profile.created_at), 'MMMM yyyy')}`}
      >
        <PassportStoriesPublicStrip
          ownerId={profile.id}
          displayName={displayName}
          avatarUrl={displayAvatarUrl}
        />
      </PassportPublicCard>
      </article>
    </main>
  )
}
