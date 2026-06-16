export type LayoutHelpTargetId =
  | 'rooms'
  | 'draw-tools'
  | 'navigation'
  | 'vendor-booths'
  | 'canvas'
  | 'save-actions'
  | 'optimize'
  | 'layout-help-btn'

export interface LayoutHelpTourStep {
  id: string
  target: LayoutHelpTargetId
  fallbackTargets?: LayoutHelpTargetId[]
  title: string
  body: string
}

export const QUICK_START_TOUR_STEPS: LayoutHelpTourStep[] = [
  {
    id: 'qs-rooms',
    target: 'rooms',
    title: 'Step 1 — Choose a room',
    body:
      'Follow the green outline in the left panel. Click a room name (e.g. Main Hall) to switch which zone you edit — each room keeps its own walls and booth layout. Use + Add room in that same panel to add Patio, Annex, or another hall.',
  },
  {
    id: 'qs-draw',
    target: 'draw-tools',
    fallbackTargets: ['navigation'],
    title: 'Step 2 — Sketch walls and doors',
    body:
      'Pick Wall, Door, or Exit from these draw tools, then click and drag on the canvas to place them along your venue perimeter. Doors on outer walls unlock traffic-flow auto-arrange later.',
  },
  {
    id: 'qs-vendors',
    target: 'vendor-booths',
    title: 'Step 3 — Place vendor booths',
    body:
      'Choose a table length (6′, 8′, 10′…), then click the vendor booth tool and click the canvas where each booth should go. Booth numbers sync to vendors after you save.',
  },
  {
    id: 'qs-nav',
    target: 'navigation',
    fallbackTargets: ['canvas'],
    title: 'Step 4 — Move around the canvas',
    body:
      'Use Hand (H) to pan — drag the canvas to explore. Select (V) clicks booths and walls to move them. Click empty space on the grid to place objects when a draw tool is active. Ctrl+Z undoes mistakes.',
  },
  {
    id: 'qs-save',
    target: 'save-actions',
    title: 'Step 5 — Save your layout',
    body:
      'Save draft writes your layout without publishing. Save layout / Save & deploy also publishes draft markets when you are ready. Fix any overlap badge before saving.',
  },
]

export const TOUR_STEPS_BY_TOPIC_ID: Record<string, LayoutHelpTourStep[]> = {
  'quick-start': QUICK_START_TOUR_STEPS,
  'rooms-add-switch': [
    {
      id: 'rooms-tabs',
      target: 'rooms',
      title: 'Room tabs',
      body:
        'Follow the green outline. Click a room name to edit that zone; use + Add room in the same panel for patios, annexes, or overflow halls. Saving stores every room together.',
    },
  ],
  'tools-walls-doors': [
    {
      id: 'draw-architecture',
      target: 'draw-tools',
      title: 'Draw tools',
      body:
        'Wall builds solid barriers. Door and Exit mark entrances on the perimeter. Click a tool, then drag on the canvas to draw.',
    },
  ],
  'vendors-place-booths': [
    {
      id: 'vendor-toolbar',
      target: 'vendor-booths',
      title: 'Vendor booths',
      body:
        'Set table length first, activate the booth tool (highlighted amber), then click the canvas. Each rectangle is one vendor footprint.',
    },
    {
      id: 'vendor-canvas',
      target: 'canvas',
      title: 'Place on the canvas',
      body:
        'Click inside the active room to drop booths. Use Select (V) to drag them into rows. Watch for red overlap highlights.',
    },
  ],
  'optimize-auto-arrange': [
    {
      id: 'optimize-run',
      target: 'optimize',
      title: 'Optimize floor plan',
      body:
        'After you have booths or tables drawn, pick Grid, Staggered, or Perimeter, then run AI Auto-Arrange to reposition objects in the active room.',
    },
  ],
  'save-draft-deploy': [
    {
      id: 'save-buttons',
      target: 'save-actions',
      title: 'Save actions',
      body:
        'Save draft is safe to use while experimenting. Deploy/publish buttons appear for draft events once overlaps are resolved.',
    },
  ],
  'tools-select-hand-draw': [
    {
      id: 'nav-tools',
      target: 'navigation',
      fallbackTargets: ['draw-tools'],
      title: 'Select and Hand',
      body:
        'Select (V) picks and moves objects. Hand (H) pans without selecting. Press D or pick a shape tool to draw walls and fixtures.',
    },
  ],
}

export function getTourStepsForTopic(topicId: string): LayoutHelpTourStep[] | null {
  const steps = TOUR_STEPS_BY_TOPIC_ID[topicId]
  return steps?.length ? steps : null
}

export function findLayoutHelpTarget(
  primary: LayoutHelpTargetId,
  fallbacks: LayoutHelpTargetId[] = []
): LayoutHelpTargetId | null {
  const order = [primary, ...fallbacks]
  for (const id of order) {
    const el = document.querySelector(`[data-layout-help="${id}"]`)
    if (el) return id
  }
  return null
}
