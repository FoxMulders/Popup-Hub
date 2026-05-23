import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'

export default async function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')
  if (profile.role !== 'coordinator') {
    redirect(profile.role === 'vendor' ? '/vendor/dashboard' : '/discover')
  }

  return (
    <div className="market-page min-h-screen">
      <AppNav profile={profile} />
      <main>{children}</main>
    </div>
  )
}
