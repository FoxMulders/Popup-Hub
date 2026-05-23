'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { UserPlus, UserCheck } from 'lucide-react'
import { toast } from 'sonner'

interface VendorFollowButtonProps {
  vendorId: string
  initialFollowing?: boolean
}

export function VendorFollowButton({
  vendorId,
  initialFollowing = false,
}: VendorFollowButtonProps) {
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
        toast.error('Sign in to follow vendors')
        return
      }
      if (following) {
        await supabase
          .from('vendor_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('vendor_id', vendorId)
        setFollowing(false)
        toast.success('Unfollowed vendor')
      } else {
        const { error } = await supabase.from('vendor_follows').insert({
          user_id: user.id,
          vendor_id: vendorId,
        })
        if (error) {
          toast.error('Could not follow vendor')
          return
        }
        setFollowing(true)
        toast.success('Following vendor')
      }
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant={following ? 'secondary' : 'outline'}
      className="min-h-11 gap-1"
      disabled={pending}
      onClick={toggle}
    >
      {following ? (
        <>
          <UserCheck className="h-4 w-4" /> Following
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" /> Follow
        </>
      )}
    </Button>
  )
}
