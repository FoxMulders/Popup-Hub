import { createClient } from '@/lib/supabase/server'
import { AppNav } from '@/components/nav/app-nav'
import type { Profile } from '@/types/database'

export default async function ShopperLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let profile: Profile | null = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    profile = data as Profile
  }

  return (
    <div className="flex flex-col min-h-screen">
      {profile ? (
        <AppNav profile={profile} />
      ) : (
        <GuestNav />
      )}
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}

function GuestNav() {
  return (
    <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3 xl:px-10">
        <a href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Popup Hub</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="/login">
            <button className="h-9 px-4 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              Sign in
            </button>
          </a>
          <a href="/signup">
            <button className="h-9 px-4 text-sm font-medium bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors">
              Get started
            </button>
          </a>
        </div>
      </div>
    </nav>
  )
}
