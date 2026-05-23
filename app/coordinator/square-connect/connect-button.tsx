'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle, ExternalLink } from 'lucide-react'

export function ConnectSquareButton({ oauthUrl }: { oauthUrl: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Connect your Square account</span>
        <Tooltip>
          <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
          <TooltipContent className="max-w-xs">Connect your Square merchant account to receive booth payment payouts directly to your bank account.</TooltipContent>
        </Tooltip>
      </div>
      <a href={oauthUrl} className="block">
        <Button className="w-full bg-[#006AFF] hover:bg-[#0057CC] text-white">
          <ExternalLink className="mr-2 h-4 w-4" />
          Connect with Square
        </Button>
      </a>
    </div>
  )
}
