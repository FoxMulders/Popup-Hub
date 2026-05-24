'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface MarkClearedWithoutPhotoProps {
  applicationId: string
  onCleared: () => void
}

export function MarkClearedWithoutPhoto({ applicationId, onCleared }: MarkClearedWithoutPhotoProps) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleMark() {
    setLoading(true)
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('booth_applications')
      .update({
        booth_cleared: true,
        booth_cleared_at: now,
        booth_cleared_photo_url: null,
      })
      .eq('id', applicationId)
    setLoading(false)
    if (error) {
      toast.error('Failed to mark cleared')
      return
    }
    toast.success('Marked as cleared')
    onCleared()
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleMark}
      disabled={loading}
      className="gap-1.5 border-sage-200 text-sage-800 hover:bg-sage-50"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
      Mark cleared
    </Button>
  )
}
