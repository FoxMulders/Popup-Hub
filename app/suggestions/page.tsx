import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MyFeatureRequests } from '@/components/feedback/my-feature-requests'
import type { UserFeatureRequest } from '@/types/database'

export const metadata = {
  title: 'My Suggestions | Popup Hub',
}

const USER_FEATURE_REQUEST_COLUMNS =
  'id, title, status, resolution_notes, problem, dream_solution, impact_level, target_component, submitter_role, screenshot_url, page_path, created_at, updated_at, resolved_at, reopened_at'

export default async function SuggestionsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data, error } = await supabase
    .from('feature_requests')
    .select(USER_FEATURE_REQUEST_COLUMNS)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-8 sm:px-6 xl:px-16">
        <div className="market-panel p-6">
          <p className="text-sm text-destructive">Could not load your suggestions: {error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1400px] px-4 py-8 sm:px-6 xl:px-16">
      <header className="mb-6 space-y-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">My Suggestions</h1>
        <p className="text-sm text-muted-foreground">
          Track feature requests you&apos;ve submitted and see what we&apos;ve shipped.
        </p>
      </header>

      <Suspense
        fallback={
          <div className="market-panel p-8 text-center text-sm text-muted-foreground">Loading…</div>
        }
      >
        <MyFeatureRequests initialRequests={(data ?? []) as UserFeatureRequest[]} />
      </Suspense>
    </div>
  )
}
