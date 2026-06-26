'use client'

import Link from 'next/link'
import { Signpost } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface BoothSignButtonProps {
  eventId: string
  className?: string
}

export function BoothSignButton({ eventId, className }: BoothSignButtonProps) {
  return (
    <Link
      href={`/vendor/events/${eventId}/booth-sign`}
      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), className ?? 'h-9 text-xs')}
    >
      <Signpost className="mr-1.5 h-3.5 w-3.5" />
      Print booth sign
    </Link>
  )
}
