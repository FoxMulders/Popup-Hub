'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WalletDoorCopyButtonProps {
  value: string
  label?: string
  className?: string
}

export function WalletDoorCopyButton({
  value,
  label = 'Copy wallet ID',
  className,
}: WalletDoorCopyButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('gap-1.5', className)}
      onClick={() => {
        void navigator.clipboard.writeText(value)
        toast.success('Wallet ID copied')
      }}
    >
      <Copy className="h-3.5 w-3.5" />
      {label}
    </Button>
  )
}
