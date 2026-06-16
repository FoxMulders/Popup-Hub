/**
 * Local Market Organizer theme — class bundles for tactile signage UI.
 * Tokens live in app/globals.css (@theme + :root).
 */

export const marketTheme = {
  page: 'market-page min-h-screen',
  panel: 'market-panel',
  panelHeader: 'market-panel-header',
  panelTitle: 'market-panel-title',
  sectionTitle: 'market-section-title',
  tableWrap: 'market-table-wrap',
  checklistTag: 'market-checklist-tag',
  checklistTagActive: 'market-checklist-tag--active',
  checklistTagDone: 'market-checklist-tag--done',
  checklistTagPending: 'market-checklist-tag--pending',
  /** Uppercase field labels on control bars */
  labelCaps: 'text-xs font-medium uppercase tracking-wide text-muted-foreground',
  /** Secondary hint copy */
  hint: 'text-[10px] text-muted-foreground',
  /** Tactile segmented control track */
  segmentTrack: 'flex rounded-xl border border-stone-200/70 overflow-hidden bg-card',
  segmentActive: 'bg-forest text-primary-foreground',
  segmentIdle: 'text-foreground hover:bg-canvas transition-colors duration-200',
  /** Primary CTA (prefer Button default when possible) */
  cta: 'bg-forest text-primary-foreground shadow-[var(--shadow-market-lift)] hover:bg-forest-deep hover:shadow-[var(--shadow-market-md)] transition-all duration-200',
} as const

/** Semantic status badge classes (approved / pending / cancelled). */
export const marketStatusBadge = {
  success: 'bg-sage-100 text-sage-800 border border-sage-200',
  warning: 'bg-harvest-100 text-harvest-800 border border-harvest-200',
  error: 'bg-terracotta-50 text-terracotta-800 border border-terracotta-200',
  neutral: 'bg-stone-100 text-stone-700 border border-stone-200',
} as const

/** Payment / check-in semantic chips */
export const marketChip = {
  paid: 'bg-sage-100 text-sage-800 border border-sage-200',
  unpaid: 'bg-harvest-50 text-harvest-800 border border-harvest-200',
  declined: 'bg-terracotta-50 text-terracotta-800 border border-terracotta-200',
} as const
