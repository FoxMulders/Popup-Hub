import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveProfileAvatarForServer } from '@/lib/profile/server-avatar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PassportStoriesPublicStrip } from '@/components/passport/passport-stories-public-strip'
import { format } from 'date-fns'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PatronPublicProfilePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, created_at')
    .eq('id', id)
    .eq('role', 'shopper')
    .single()

  if (!profile) notFound()

  const displayAvatarUrl = await resolveProfileAvatarForServer(supabase, profile)

  const initials = profile.full_name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="rounded-2xl border bg-white p-6 shadow-sm space-y-4">
        <PassportStoriesPublicStrip
          ownerId={profile.id}
          displayName={profile.full_name}
          avatarUrl={displayAvatarUrl}
        />

        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            <AvatarImage src={displayAvatarUrl ?? undefined} />
            <AvatarFallback className="bg-harvest-100 text-harvest-700 text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground truncate">{profile.full_name}</h1>
            <p className="text-sm text-muted-foreground">Market Patron</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Member since {format(new Date(profile.created_at), 'MMMM yyyy')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
