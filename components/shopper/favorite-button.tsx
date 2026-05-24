'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FavoriteButtonProps {
  eventId: string
  initialFavorited?: boolean
  size?: 'sm' | 'default'
  className?: string
  iconOnly?: boolean
}

export function FavoriteButton({
  eventId,
  initialFavorited = false,
  size = 'default',
  className,
  iconOnly = false,
}: FavoriteButtonProps) {
  const router = useRouter()
  const supabase = createClient()
  const [favorited, setFavorited] = useState(initialFavorited)
  const [pending, startTransition] = useTransition()

  async function toggle(e?: React.MouseEvent) {
    e?.preventDefault()
    e?.stopPropagation()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      router.push(`/login?redirectTo=${encodeURIComponent(`/events/${eventId}`)}`)
      return
    }

    startTransition(async () => {
      if (favorited) {
        const { error } = await supabase
          .from('shopper_favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('event_id', eventId)
        if (error) {
          toast.error('Could not remove favorite')
          return
        }
        setFavorited(false)
        toast.success('Removed from favorites')
      } else {
        const { error } = await supabase.from('shopper_favorites').insert({
          user_id: user.id,
          event_id: eventId,
        })
        if (error) {
          toast.error('Could not save favorite')
          return
        }
        setFavorited(true)
        toast.success('Saved to favorites')
      }
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={size === 'sm' ? 'sm' : 'default'}
      className={cn(
        'gap-1 touch-manipulation',
        favorited && 'border-red-200 bg-red-50 text-red-600',
        iconOnly && 'px-0',
        className
      )}
      disabled={pending}
      onClick={toggle}
      aria-pressed={favorited}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
      {!iconOnly && size !== 'sm' && (favorited ? 'Saved' : 'Favorite')}
    </Button>
  )
}

/** Prompt guests to sign in for favorites */
export function FavoriteSignInLink({ eventId }: { eventId: string }) {
  return (
    <Link href={`/login?redirectTo=${encodeURIComponent(`/events/${eventId}`)}`}>
      <Button type="button" variant="outline" size="sm" className="gap-1">
        <Heart className="h-4 w-4" /> Sign in to save
      </Button>
    </Link>
  )
}
