/** QA staging — single browser scrollbar; no nested viewport traps. */
export const QA_GLOBAL_PAGE_SCROLL = true

/** Step 3 workspace column — scrollable flex column, no viewport lock. */
export const QA_STEP3_CONTENT_CLASS = 'flex flex-col h-full overflow-y-auto'

/** Outer canvas column — fills workspace; pan/zoom owns internal scroll. */
export const QA_CANVAS_VIEWPORT_CLASS =
  'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-slate-50'

/** Inner canvas host — flex-grow, pan/zoom defers to page scroll. */
export const QA_CANVAS_CONTAINER_CLASS =
  'canvas-container pointer-events-auto relative w-full flex-grow h-auto overflow-visible bg-stone-100 outline-none'

/** Add room toolbar block — stays above canvas overlay. */
export const QA_ADD_ROOM_FORM_CLASS = 'relative z-10'
