'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { roleDocumentTitle } from '@/lib/auth/document-title'
import type { Role } from '@/types/database'

interface DocumentTitleSyncProps {
  initialRole: Role | null
}

async function fetchProfileRole(userId: string): Promise<Role> {
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  return (profile?.role as Role | undefined) ?? 'shopper'
}

export function DocumentTitleSync({ initialRole }: DocumentTitleSyncProps) {
  useEffect(() => {
    document.title = roleDocumentTitle(initialRole)

    const supabase = createClient()

    async function syncTitleForSession(userId: string | undefined) {
      if (!userId) {
        document.title = roleDocumentTitle(null)
        return
      }

      const role = await fetchProfileRole(userId)
      document.title = roleDocumentTitle(role)
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncTitleForSession(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [initialRole])

  return null
}
