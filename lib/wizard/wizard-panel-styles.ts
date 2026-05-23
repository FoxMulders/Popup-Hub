import { cn } from '@/lib/utils'

/** Canonical wizard shell — Step 4 `market-panel` (cream/white, stone borders). */
export const WIZARD_PANEL = 'market-panel'

/** Step body spacing (no nested panel — parent `WIZARD_PANEL` provides the card). */
export const WIZARD_PANEL_INNER = 'space-y-4'

/** Wizard page kicker — "Market Setup Wizard · Step N of 4". */
export const WIZARD_PAGE_KICKER =
  'text-xs font-heading font-semibold uppercase tracking-wide text-muted-foreground'

/** Primary wizard page title — e.g. "Edit Market". */
export const WIZARD_PAGE_TITLE =
  'font-heading text-2xl sm:text-3xl font-semibold text-foreground whitespace-normal break-words'

/** Step heading — booth-planner Step 4 titles. */
export const WIZARD_STEP_TITLE =
  'text-sm font-heading font-semibold uppercase tracking-wide text-forest'

/** Section / rail heading — e.g. layout-room-bar "Rooms / zones". */
export const WIZARD_SECTION_LABEL =
  'text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wide'

/** Field label — e.g. booth-planner dimension inputs. */
export const WIZARD_FIELD_LABEL =
  'text-xs font-medium uppercase tracking-wide text-muted-foreground'

export const WIZARD_INPUT =
  'rounded-lg border-2 border-stone-200 bg-card px-2 py-1.5 text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-forest/30'

export const WIZARD_TEXTAREA = cn(WIZARD_INPUT, 'whitespace-normal break-words')

/** Select/dropdown layers — no truncation on long venue or category names. */
export const WIZARD_SELECT_TRIGGER = cn(
  WIZARD_INPUT,
  'w-full min-w-[200px] h-auto min-h-11 whitespace-normal break-words py-2'
)

export const WIZARD_SELECT_CONTENT = 'max-w-[min(100vw-2rem,28rem)]'

export const WIZARD_SELECT_ITEM =
  'w-full min-w-[200px] h-auto whitespace-normal break-words py-2 items-start'

export const WIZARD_CALLOUT =
  'text-xs font-medium text-forest bg-sage-50 border border-sage-200 rounded-lg px-3 py-2 whitespace-normal break-words'

export const WIZARD_INFO_BOX =
  'text-xs text-muted-foreground rounded-lg border border-stone-200 bg-canvas px-3 py-2 whitespace-normal break-words'

export const WIZARD_TOGGLE_GROUP =
  'flex rounded-lg border-2 border-stone-200 overflow-hidden bg-card'

export const WIZARD_TOGGLE_OPTION =
  'flex-1 min-h-11 px-3 py-2 text-xs font-medium transition-all duration-200 active:translate-y-0.5'

export const WIZARD_TOGGLE_OPTION_ACTIVE = 'bg-forest text-primary-foreground'

export const WIZARD_TOGGLE_OPTION_INACTIVE = 'text-foreground hover:bg-canvas'

export const WIZARD_DRAFT_BADGE =
  'inline-flex items-center rounded-md border border-stone-200 bg-harvest-50 px-3 py-1 text-xs font-heading font-semibold uppercase tracking-wide text-muted-foreground'

export const WIZARD_BTN_PRIMARY = 'min-h-11 gap-1.5 transition-all duration-200'

export const WIZARD_BTN_SECONDARY = 'min-h-11 gap-1.5 transition-all duration-200'

export const WIZARD_NAV_DIVIDER = 'border-t border-stone-200/80'

/** Summary rail field label. */
export const WIZARD_SUMMARY_META_LABEL =
  'text-[10px] font-semibold uppercase text-muted-foreground'

/** Summary rail value chip — default. */
export const WIZARD_SUMMARY_VALUE =
  'mt-0.5 rounded-lg border border-stone-200 bg-canvas px-2 py-1.5 whitespace-normal break-words text-sm'

export const WIZARD_SUMMARY_VALUE_EMPHASIS =
  'mt-0.5 rounded-lg border border-stone-200 bg-linen px-2 py-1.5 font-medium whitespace-normal break-words text-sm'

export const WIZARD_SUMMARY_VALUE_SAGE =
  'mt-0.5 rounded-lg border border-sage-200 bg-sage-50 px-2 py-1.5 whitespace-normal break-words text-sm'

export const WIZARD_SUMMARY_VALUE_WARN =
  'mt-0.5 rounded-lg border border-harvest-200 bg-harvest-50 px-2 py-1.5 whitespace-normal break-words text-sm'

export const DEFAULT_MARKET_START = '08:00'
export const DEFAULT_MARKET_END = '15:00'
