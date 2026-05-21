'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { CheckCheck } from 'lucide-react'

export default function MarkAllReadButton({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleMarkAll() {
    setLoading(true)
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    setLoading(false)
    router.refresh()
  }

  return (
    <Button variant="outline" size="sm" onClick={handleMarkAll} disabled={loading} className="gap-2">
      <CheckCheck className="h-4 w-4" />
      Mark all read
    </Button>
  )
}
