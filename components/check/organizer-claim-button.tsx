'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

type Props = {
  organizerSlug: string
  displayName: string
  isClaimed: boolean
  canClaim: boolean
}

export function OrganizerClaimButton({
  organizerSlug,
  displayName,
  isClaimed,
  canClaim,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (isClaimed || !canClaim) return null

  async function handleClaim() {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizers/${organizerSlug}/claim`, { method: 'POST' })
      const data = (await res.json()) as { error?: string; nextPath?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not claim profile')
        return
      }
      toast.success(`You claimed ${displayName}.`)
      if (data.nextPath) router.push(data.nextPath)
      else router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-harvest-200 bg-harvest-50/40 px-4 py-4 text-sm space-y-2">
      <p className="font-medium text-foreground">Are you {displayName}?</p>
      <p className="text-muted-foreground">
        Claim this trust profile to respond to vendor reviews and sync your PopUp Hub markets.
      </p>
      <Button type="button" size="sm" onClick={() => void handleClaim()} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Claiming…
          </>
        ) : (
          'Claim this profile'
        )}
      </Button>
    </div>
  )
}
