'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Bell, BellOff } from 'lucide-react'
import { toast } from '@/lib/toast'

interface CoordinatorFollowButtonProps {
  coordinatorId: string
  coordinatorName?: string
  initialFollowing?: boolean
  size?: 'default' | 'sm'
  className?: string
}

export function CoordinatorFollowButton({
  coordinatorId,
  coordinatorName,
  initialFollowing = false,
  size = 'default',
  className,
}: CoordinatorFollowButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [following, setFollowing] = useState(initialFollowing)
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        toast.error('Sign in to follow organizers')
        return
      }
      if (user.id === coordinatorId) {
        toast.error('You cannot follow your own organizer profile')
        return
      }
      if (following) {
        await supabase
          .from('coordinator_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('coordinator_id', coordinatorId)
        setFollowing(false)
        toast.success('Unfollowed organizer')
      } else {
        const { error } = await supabase.from('coordinator_follows').insert({
          user_id: user.id,
          coordinator_id: coordinatorId,
        })
        if (error) {
          toast.error('Could not follow organizer')
          return
        }
        setFollowing(true)
        toast.success(
          coordinatorName
            ? `Following ${coordinatorName} — we will notify you when they publish new markets`
            : 'Following organizer'
        )
      }
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant={following ? 'secondary' : 'outline'}
      size={size}
      className={`min-h-10 gap-1.5 ${className ?? ''}`}
      disabled={pending}
      onClick={() => void toggle()}
    >
      {following ? (
        <>
          <BellOff className="h-4 w-4" aria-hidden />
          Following
        </>
      ) : (
        <>
          <Bell className="h-4 w-4" aria-hidden />
          Follow organizer
        </>
      )}
    </Button>
  )
}
