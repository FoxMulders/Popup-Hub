import * as React from 'react'
import { cn } from '@/lib/utils'
import { marketTheme } from '@/lib/theme/market'

function MarketPanel({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn(marketTheme.panel, className)} {...props} />
}

function MarketPanelHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn(marketTheme.panelHeader, className)} {...props} />
}

function MarketPanelTitle({ className, ...props }: React.ComponentProps<'h3'>) {
  return <h3 className={cn(marketTheme.panelTitle, className)} {...props} />
}

function MarketSectionTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn(marketTheme.sectionTitle, className)} {...props} />
}

export { MarketPanel, MarketPanelHeader, MarketPanelTitle, MarketSectionTitle }
