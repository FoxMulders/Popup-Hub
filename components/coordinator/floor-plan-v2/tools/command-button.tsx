'use client'

import { cn } from '@/lib/utils'

export function CommandButton({
  onClick,
  disabled,
  title,
  label,
  children,
  className,
  active,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  label?: string
  children: React.ReactNode
  className?: string
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-40',
        active && 'bg-stone-900 text-white hover:bg-stone-800',
        className
      )}
    >
      {children}
      {label ? <span className="hidden md:inline">{label}</span> : null}
    </button>
  )
}
