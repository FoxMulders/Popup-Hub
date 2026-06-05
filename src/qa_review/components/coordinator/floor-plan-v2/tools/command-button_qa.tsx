'use client'

import { createContext, useContext } from 'react'
import { TooltipWrapperQa } from '@/src/qa_review/components/coordinator/dashboard/tooltip-wrapper_qa'
import { cn } from '@/lib/utils'

const ToolbarCompactContext = createContext(false)

export function ToolbarCompactProvider({
  compact,
  children,
}: {
  compact?: boolean
  children: React.ReactNode
}) {
  return (
    <ToolbarCompactContext.Provider value={compact ?? false}>
      {children}
    </ToolbarCompactContext.Provider>
  )
}

function useToolbarCompact(explicit?: boolean): boolean {
  const inherited = useContext(ToolbarCompactContext)
  return explicit ?? inherited
}

export function toolbarControlHeight(compact: boolean): string {
  return compact ? 'h-[1.65rem]' : 'h-7'
}

export function toolbarIconButtonSize(compact: boolean): string {
  return compact ? 'h-[1.65rem] w-[1.65rem]' : 'h-7 w-7'
}

export function toolbarDividerClass(compact: boolean): string {
  return cn('mx-0.5 w-px bg-stone-200', compact ? 'h-[1.25rem]' : 'h-5')
}

export function CommandButtonQa({
  onClick,
  disabled,
  title,
  children,
  className,
  active,
  compact,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  /** @deprecated Labels are icon-only; use `title` for tooltip text. */
  label?: string
  children: React.ReactNode
  className?: string
  active?: boolean
  compact?: boolean
}) {
  const isCompact = useToolbarCompact(compact)
  return (
    <TooltipWrapperQa text={title}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={title}
        aria-pressed={active}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-md p-0 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40 touch-manipulation',
          'min-h-12 min-w-12 md:min-h-0 md:min-w-0',
          isCompact ? 'md:h-[1.65rem] md:w-[1.65rem]' : 'md:h-7 md:w-7',
          active && 'bg-stone-900 text-white hover:bg-stone-800',
          className
        )}
      >
        {children}
      </button>
    </TooltipWrapperQa>
  )
}
