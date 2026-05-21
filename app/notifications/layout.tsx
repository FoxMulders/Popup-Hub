import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'
import type { Profile } from '@/types/database'

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (!profile) redirect('/login')

  return (
    <div className="min-h-screen bg-gray-50">
      <AppNav profile={profile as Profile} />
      <main>{children}</main>
    </div>
  )
}
