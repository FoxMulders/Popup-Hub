import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/types/database'

export const getSessionRoleForTitle = cache(async (): Promise<Role | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return (profile?.role as Role | undefined) ?? 'shopper'
})
