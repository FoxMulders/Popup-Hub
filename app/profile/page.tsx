import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppNav } from '@/components/nav/app-nav'
import type { Profile } from '@/types/database'
import { ProfileForm } from './profile-form'

export default async function ProfilePage() {
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
    <>
      <AppNav profile={profile as Profile} />
      <div className="mx-auto max-w-[1400px] px-6 py-10 xl:px-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900">Profile Settings</h1>
          <p className="mt-1.5 text-lg text-gray-500">Manage your account and notification preferences</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-10">
          <ProfileForm profile={profile as Profile} />

          {/* Sidebar info */}
          <aside className="space-y-6">
            <div className="rounded-2xl border bg-white p-6">
              <h3 className="font-semibold text-gray-900 mb-3">SMS Notifications</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Add your phone number to receive SMS alerts for important events like auction wins,
                application approvals, and waitlist promotions.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  Auction win notifications
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                  Application approval alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                  Waitlist promotion alerts
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border bg-amber-50 border-amber-100 p-6">
              <h3 className="font-semibold text-amber-900 mb-2">Account Role</h3>
              <p className="text-sm text-amber-700 capitalize font-medium">{profile.role}</p>
              <p className="text-xs text-amber-600 mt-1.5">
                Contact support to change your account role.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
