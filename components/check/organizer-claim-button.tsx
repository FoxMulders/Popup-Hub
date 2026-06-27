'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

type Props = {
  organizerSlug: string
  displayName: string
  isClaimed: boolean
  canClaim: boolean
  claimPending?: boolean
}

export function OrganizerClaimButton({
  organizerSlug,
  displayName,
  isClaimed,
  canClaim,
  claimPending = false,
}: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [note, setNote] = useState('')
  const [submitted, setSubmitted] = useState(claimPending)

  if (isClaimed || (!canClaim && !submitted)) return null

  if (submitted) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-4 text-sm space-y-2">
        <p className="font-medium text-foreground">Claim submitted for review</p>
        <p className="text-muted-foreground">
          A platform admin will verify you manage {displayName} before this HubGuard profile is
          linked to your coordinator account.
        </p>
      </div>
    )
  }

  async function handleClaim() {
    setLoading(true)
    try {
      const res = await fetch(`/api/organizers/${organizerSlug}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationNote: note.trim() || null }),
      })
      const data = (await res.json()) as { error?: string; status?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not submit claim')
        return
      }
      setSubmitted(true)
      toast.success(`Claim submitted for ${displayName}. An admin will review it shortly.`)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-harvest-200 bg-harvest-50/40 px-4 py-4 text-sm space-y-3">
      <p className="font-medium text-foreground">Are you {displayName}?</p>
      <p className="text-muted-foreground">
        Submit a claim to manage this trust profile. Platform admins verify coordinator ownership
        before you can respond to reviews or sync PopUp Hub markets.
      </p>
      <div className="space-y-2">
        <Label htmlFor="claim-verification-note" className="text-xs">
          How can we verify you run this market? (optional)
        </Label>
        <Textarea
          id="claim-verification-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Official website, business email domain, market social accounts, or other proof."
        />
      </div>
      <Button type="button" size="sm" onClick={() => void handleClaim()} disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Submitting…
          </>
        ) : (
          'Submit claim for review'
        )}
      </Button>
    </div>
  )
}
