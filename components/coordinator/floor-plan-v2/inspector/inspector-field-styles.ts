import { cn } from '@/lib/utils'

/** Shared label typography for floor-plan inspector controls. */
export const inspectorLabelClass =
  'text-[0.625rem] font-semibold uppercase tracking-wide text-stone-600 sm:text-xs'

/** Base control chrome (inputs, selects). */
export const inspectorControlClass =
  'w-full min-w-0 rounded-md border border-stone-300 bg-white px-2 py-1 text-xs font-medium normal-case text-stone-800 transition-[border-color,box-shadow] duration-150'

/** WCAG 2.2 AA focus — use on all interactive inspector controls. */
export const inspectorFocusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1'

export function inspectorControlClassName(extra?: string) {
  return cn(inspectorControlClass, inspectorFocusRingClass, extra)
}

/** Segmented / preset toggle buttons in the inspector. */
export const inspectorToggleBaseClass =
  'inline-flex min-h-8 min-w-[2.75rem] items-center justify-center rounded-md border px-2 py-1 text-[0.625rem] font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 sm:text-xs'

export function inspectorToggleClassName(active: boolean, extra?: string) {
  return cn(
    inspectorToggleBaseClass,
    inspectorFocusRingClass,
    active
      ? 'border-sky-600 bg-sky-600 text-white'
      : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50',
    extra
  )
}

/** Table-cluster panel accent (sky). */
export const clusterPanelClass =
  '@container flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50/60 p-3'

export const clusterHeadingClass =
  'text-[0.625rem] font-semibold uppercase tracking-wide text-sky-900 sm:text-xs'

export const clusterBodyClass = 'text-[0.625rem] leading-snug text-sky-800 sm:text-xs'

export const clusterHintClass = 'text-[0.5625rem] text-stone-500 sm:text-[0.625rem]'

/** Unstyled fieldset reset — legend supplies visible grouping. */
export const inspectorFieldsetClass = 'min-w-0 border-0 p-0'

export const inspectorLegendClass =
  'mb-1 block w-full text-[0.625rem] font-semibold uppercase tracking-wide text-stone-600 sm:text-xs'
