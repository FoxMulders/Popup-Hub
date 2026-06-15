import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { hasAdminAccess } from '@/lib/auth/require-admin'
import { accessDeniedRedirect } from '@/lib/auth/rbac'
import { createClient } from '@/lib/supabase/server'
import { COORDINATOR_STUDIO_PATH } from '@/lib/coordinator/coordinator-routes'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const allowed = await hasAdminAccess()
  if (!allowed) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: profile } = user
      ? await supabase.from('profiles').select('role').eq('id', user.id).single()
      : { data: null }
    redirect(accessDeniedRedirect(profile?.role))
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="safe-top shrink-0 border-b border-border bg-card/90 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Platform Admin
            </p>
            <h1 className="font-heading text-lg font-semibold text-foreground">Operations Console</h1>
          </div>
          <Link
            href={COORDINATOR_STUDIO_PATH}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted/60"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Blueprint Studio
          </Link>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col p-4">
        {children}
      </main>
    </div>
  )
}
