import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveProfileAvatarForServer } from '@/lib/profile/server-avatar'
import { loadPublicPassportIndex } from '@/lib/passport/public-passport-index'
import { PassportPublicCard } from '@/components/passport/passport-public-card'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
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
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

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
    </div>
  )
}
