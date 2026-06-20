'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DemoMarketLauncherProps {
  className?: string
  variant?: 'default' | 'outline'
  size?: 'default' | 'sm'
}

export function DemoMarketLauncher({
  className,
  variant = 'outline',
  size = 'default',
}: DemoMarketLauncherProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleLaunch() {
    setLoading(true)
    try {
      const res = await fetch('/api/coordinator/demo-market', { method: 'POST' })
      const data = (await res.json()) as { error?: string; nextPath?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not create demo market')
        return
      }
      toast.success('Demo market created — open HubGrid to place a few booths, then publish when ready.')
      if (data.nextPath) router.push(data.nextPath)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
      disabled={loading}
      onClick={() => void handleLaunch()}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <FlaskConical className="h-4 w-4" aria-hidden />
      )}
      Try demo market (~10 min)
    </Button>
  )
}
