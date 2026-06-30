'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2 } from 'lucide-react'
import { toast } from '@/lib/toast'
import { Button } from '@/components/ui/button'

interface CloneMarketButtonProps {
  eventId: string
  size?: 'default' | 'sm'
  variant?: 'default' | 'outline' | 'ghost'
}

export function CloneMarketButton({
  eventId,
  size = 'sm',
  variant = 'outline',
}: CloneMarketButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClone() {
    setLoading(true)
    try {
      const res = await fetch(`/api/coordinator/events/${eventId}/clone`, { method: 'POST' })
      const data = (await res.json()) as { error?: string; nextPath?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not clone market')
        return
      }
      toast.success('Market cloned as draft — dates moved one week forward.')
      if (data.nextPath) router.push(data.nextPath)
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className="gap-1.5"
      disabled={loading}
      onClick={() => void handleClone()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Copy className="h-4 w-4" aria-hidden />
      )}
      Clone market
    </Button>
  )
}
