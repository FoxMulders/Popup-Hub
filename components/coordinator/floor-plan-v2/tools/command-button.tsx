'use client'

import { createContext, useContext } from 'react'
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
  return compact ? 'h-[1.8rem]' : 'h-8'
}

export function toolbarDividerClass(compact: boolean): string {
  return cn('mx-0.5 w-px bg-stone-200', compact ? 'h-[1.35rem]' : 'h-6')
}

export function CommandButton({
  onClick,
  disabled,
  title,
  label,
  children,
  className,
  active,
  compact,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  label?: string
  children: React.ReactNode
  className?: string
  active?: boolean
  compact?: boolean
}) {
  const isCompact = useToolbarCompact(compact)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40',
        toolbarControlHeight(isCompact),
        active && 'bg-stone-900 text-white hover:bg-stone-800',
        className
      )}
    >
      {children}
      {label ? <span className="hidden md:inline">{label}</span> : null}
    </button>
  )
}
