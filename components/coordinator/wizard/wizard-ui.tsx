'use client'

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WIZARD_BTN_PRIMARY, WIZARD_INPUT, WIZARD_TEXTAREA } from '@/lib/wizard/wizard-panel-styles'
import type { WizardStep } from '@/components/coordinator/wizard/wizard-nav'

/** Applied by `focusWizardField` on validation errors — shake + soft red glow. */
export const WIZARD_FIELD_ERROR_CLASS = 'wizard-field-error'

const stepGlowClass: Record<WizardStep, string> = {
  1: 'wizard-ambient--step-1',
  2: 'wizard-ambient--step-2',
  3: 'wizard-ambient--step-3',
}

export function WizardAmbientShell({
  step,
  children,
  className,
}: {
  step: WizardStep
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'wizard-ambient relative isolate flex min-h-0 flex-col',
        stepGlowClass[step],
        className
      )}
    >
      <div className="wizard-ambient__orb wizard-ambient__orb--a" aria-hidden />
      <div className="wizard-ambient__orb wizard-ambient__orb--b" aria-hidden />
      <div className="relative z-[1] flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  )
}

export function WizardGlassPanel({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'aside' | 'nav'
}) {
  return <Tag className={cn('wizard-glass-panel', className)}>{children}</Tag>
}

/** Step 1 zone — scroll anchor, glass panel, optional error halo from validation. */
export function WizardZone({
  id,
  title,
  subtitle,
  children,
  className,
  variant = 'stack',
}: {
  id: string
  title: string
  subtitle?: string
  children: ReactNode
  className?: string
  variant?: 'stack' | 'wide' | 'canvas'
}) {
  return (
    <section
      id={id}
      role="region"
      aria-labelledby={`${id}-title`}
      className={cn(
        'wizard-zone wizard-glass-panel scroll-mt-24',
        variant === 'canvas'
          ? 'flex min-h-0 flex-1 flex-col p-3 sm:p-4 wizard-zone--canvas'
          : 'p-4 sm:p-5',
        variant === 'wide' && 'wizard-zone--wide',
        className
      )}
    >
      <header className={cn('space-y-1', variant === 'canvas' ? 'mb-2 shrink-0' : 'mb-4')}>
        <h3
          id={`${id}-title`}
          className="wizard-zone-title font-sans text-[clamp(0.9375rem,0.4vw+0.85rem,1.125rem)] font-bold tracking-tight text-forest"
        >
          {title}
        </h3>
        {subtitle ? (
          <p className="text-[0.8125rem] leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>
      <div
        className={cn(
          variant === 'canvas' && 'flex min-h-0 flex-1 flex-col gap-2',
          variant === 'wide' && 'lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 space-y-4',
          variant === 'stack' && 'space-y-4'
        )}
      >
        {children}
      </div>
    </section>
  )
}

export function WizardSectionTitle({
  children,
  className,
  active = true,
}: {
  children: ReactNode
  className?: string
  active?: boolean
}) {
  return (
    <h2
      className={cn(
        'wizard-section-title font-sans font-semibold text-forest transition-[letter-spacing,font-weight] duration-300',
        active && 'tracking-[0.06em]',
        className
      )}
    >
      {children}
    </h2>
  )
}

export function WizardDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-px w-full bg-gradient-to-r from-transparent via-stone-300/70 to-transparent',
        className
      )}
      aria-hidden
    />
  )
}

function useSpotlightHandlers() {
  const ref = useRef<HTMLDivElement>(null)

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    el.style.setProperty('--spotlight-x', `${x}%`)
    el.style.setProperty('--spotlight-y', `${y}%`)
  }, [])

  return { ref, onMouseMove }
}

export function WizardFloatingInput({
  id,
  label,
  className,
  value,
  ...props
}: React.ComponentProps<typeof Input> & { label: string }) {
  const { ref, onMouseMove } = useSpotlightHandlers()
  const filled = Boolean(value != null && String(value).trim())

  return (
    <div
      ref={ref}
      className={cn('wizard-floating-field', filled && 'wizard-floating-field--filled')}
      onMouseMove={onMouseMove}
    >
      <Input
        id={id}
        value={value}
        placeholder=" "
        className={cn(WIZARD_INPUT, 'wizard-floating-input peer', className)}
        {...props}
      />
      <label htmlFor={id} className="wizard-floating-label">
        {label}
      </label>
    </div>
  )
}

export function WizardFloatingTextarea({
  id,
  label,
  className,
  value,
  ...props
}: React.ComponentProps<typeof Textarea> & { label: string }) {
  const { ref, onMouseMove } = useSpotlightHandlers()
  const filled = Boolean(value != null && String(value).trim())

  return (
    <div
      ref={ref}
      className={cn('wizard-floating-field wizard-floating-field--textarea', filled && 'wizard-floating-field--filled')}
      onMouseMove={onMouseMove}
    >
      <Textarea
        id={id}
        value={value}
        placeholder=" "
        className={cn(WIZARD_TEXTAREA, 'wizard-floating-input peer min-h-[5rem]', className)}
        {...props}
      />
      <label htmlFor={id} className="wizard-floating-label">
        {label}
      </label>
    </div>
  )
}

export function WizardSelectionCard({
  selected,
  onSelect,
  children,
  className,
  'aria-label': ariaLabel,
}: {
  selected: boolean
  onSelect: () => void
  children: ReactNode
  className?: string
  'aria-label'?: string
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.button
      type="button"
      aria-pressed={selected}
      aria-label={ariaLabel}
      onClick={onSelect}
      className={cn(
        'wizard-selection-card',
        selected && 'wizard-selection-card--selected',
        className
      )}
      whileTap={reduceMotion ? undefined : { scale: 0.96 }}
      animate={reduceMotion ? undefined : { scale: selected ? 1.03 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
    >
      {children}
    </motion.button>
  )
}

export function WizardSelectionGroup({
  children,
  className,
  label,
}: {
  children: ReactNode
  className?: string
  label?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}
    >
      {children}
    </div>
  )
}

export function WizardSwitchRow({
  id,
  label,
  description,
  control,
}: {
  id: string
  label: string
  description?: string
  control: ReactNode
}) {
  return (
    <div className="wizard-glass-inset flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0 space-y-1">
        <label htmlFor={id} className="wizard-field-label block cursor-pointer">
          {label}
        </label>
        {description ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

export function WizardAccordion({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const contentId = useId()
  const reduceMotion = useReducedMotion()

  return (
    <div className={cn('wizard-glass-inset overflow-hidden', className)}>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40 focus-visible:ring-offset-2"
        >
          <span className="wizard-field-label">{title}</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>
        <motion.div
          id={contentId}
          role="region"
          initial={false}
          animate={{
            height: open ? 'auto' : 0,
            opacity: open ? 1 : 0,
          }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { height: { duration: 0.35, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.25 } }
          }
          className="overflow-hidden"
        >
          <div className="border-t border-white/40 px-4 py-3">{children}</div>
        </motion.div>
    </div>
  )
}

export function WizardMapContainer({
  id,
  children,
  className,
  pinDropped,
  tabIndex,
}: {
  id?: string
  children: ReactNode
  className?: string
  pinDropped?: boolean
  tabIndex?: number
}) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      id={id}
      tabIndex={tabIndex}
      className={cn('wizard-map-container', className)}
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
      data-pin-dropped={pinDropped ? 'true' : 'false'}
    >
      {children}
    </motion.div>
  )
}

export function WizardProceedButton({
  ready,
  disabled,
  onClick,
  children,
  className,
}: {
  ready?: boolean
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <Button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        WIZARD_BTN_PRIMARY,
        'wizard-proceed-btn',
        ready && !disabled && 'wizard-proceed-btn--ready',
        className
      )}
    >
      {children}
    </Button>
  )
}

/** Animate select/dropdown panels inside the wizard shell. */
export function WizardSelectContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'wizard-select-content animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-200',
        className
      )}
      {...props}
    />
  )
}
