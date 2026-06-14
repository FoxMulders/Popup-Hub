import { MIN_STROLLER_AISLE_WIDTH_FT } from '@/lib/booth-planner/stroller-clearance'

export type LayoutEditorHelpCategory =
  | 'basics'
  | 'rooms'
  | 'tools'
  | 'vendors'
  | 'patrons'
  | 'optimize'
  | 'view'
  | 'save'

export interface LayoutEditorHelpTopic {
  id: string
  category: LayoutEditorHelpCategory
  title: string
  summary: string
  steps: string[]
  /** Extra tokens for smart search (synonyms, related phrases). */
  keywords: string[]
}

export const LAYOUT_EDITOR_HELP_CATEGORY_LABELS: Record<
  LayoutEditorHelpCategory,
  string
> = {
  basics: 'Basics',
  rooms: 'Rooms & zones',
  tools: 'Tools & drawing',
  vendors: 'Vendor booths',
  patrons: 'Patron seating',
  optimize: 'Optimize & align',
  view: 'View & display',
  save: 'Save & deploy',
}

export const LAYOUT_EDITOR_HELP_TOPICS: LayoutEditorHelpTopic[] = [
  {
    id: 'quick-start',
    category: 'basics',
    title: 'New here? Quick start in 5 steps',
    summary:
      'You do not need every toolbar button on day one. Follow this order, then search help for anything else.',
    steps: [
      'Start with a room — follow the green outline in the left panel; click a room name or use + Add room to switch or add zones (Main Hall, Patio, etc.).',
      'Sketch the venue — Draw walls, doors, and exits on the perimeter before placing booths.',
      'Place vendor booths — under Vendor Booths, pick a table length, then click the canvas to add booths.',
      'Navigate easily — H pans the canvas, V selects and moves objects, Ctrl+Z undoes mistakes.',
      'Save when ready — Save draft keeps your work; fix any overlap warnings before saving.',
    ],
    keywords: [
      'quick start',
      'beginner',
      'new',
      'first time',
      'overwhelmed',
      'start here',
      'getting started',
      'how to begin',
    ],
  },
  {
    id: 'overview',
    category: 'basics',
    title: 'Layout editor overview',
    summary:
      'Design booth grids, walkways, and fixtures on a room-based canvas. Changes sync to check-in maps and vendor assignments after you save.',
    steps: [
      'Pick a room tab, draw walls and doors, then place vendor booths and patron tables.',
      'Use Select (V) to move and resize objects; Hand (H) to pan the canvas.',
      'Watch overlap and clearance warnings before saving — overlaps block save.',
      'Save draft to persist without publishing; Save & deploy publishes draft markets.',
    ],
    keywords: [
      'start',
      'introduction',
      'what is',
      'spatial planner',
      'floor plan',
      'workflow',
    ],
  },
  {
    id: 'keyboard-shortcuts',
    category: 'basics',
    title: 'Keyboard shortcuts',
    summary: 'Speed up editing with tool keys and standard edit shortcuts.',
    steps: [
      'V — Select tool · H — Hand (pan) · D — Draw tool',
      'Ctrl+Z / Ctrl+Shift+Z — Undo / Redo',
      'Ctrl+C / Ctrl+V / Ctrl+D — Copy, paste, duplicate selection',
      'Ctrl+A — Select all objects on the canvas',
      'Delete / Backspace — Remove selected objects',
      'Shift+H / Shift+V — Align horizontal / vertical centers (2+ selected)',
      '] — Toggle right inspector panel',
      '? — Open this help search',
      'Esc — Exit fullscreen, clear selection, or return to Select',
    ],
    keywords: ['hotkeys', 'keys', 'shortcut', 'undo', 'copy', 'paste'],
  },
  {
    id: 'rooms-add-switch',
    category: 'rooms',
    title: 'Add and switch rooms',
    summary:
      'Multi-room markets keep separate zones (Main Hall, Patio, Annex) in one saved layout.',
    steps: [
      'Use the room tabs in the toolbar to switch the active zone.',
      'Click + on the room bar to add a new room — name it when prompted.',
      'Each room has its own dimensions, fixtures, and booth placements.',
      'Saving writes every room to the layout record in one pass.',
    ],
    keywords: [
      'zone',
      'hall',
      'patio',
      'annex',
      'multi room',
      'tab',
      'switch room',
    ],
  },
  {
    id: 'rooms-resize-rotate',
    category: 'rooms',
    title: 'Resize and rotate a room',
    summary:
      'Click a room perimeter to select it, then adjust size or rotate the whole zone.',
    steps: [
      'Click the room frame on the canvas (not an object inside) to select it.',
      'Drag corner handles to resize, or use width/length fields in the room bar.',
      'Use the rotate-room buttons to turn the room and everything inside 90°.',
    ],
    keywords: [
      'dimensions',
      'width',
      'length',
      'rotate room',
      'resize room',
      'perimeter',
    ],
  },
  {
    id: 'tools-select-hand-draw',
    category: 'tools',
    title: 'Select, Hand, and Draw tools',
    summary: 'Core navigation and creation modes on the canvas.',
    steps: [
      'Select (V) — click objects to select; drag to move; Shift-click for multi-select.',
      'Hand (H) — drag the canvas to pan; scroll or pinch to zoom.',
      'Draw (D) — activate shape tools: wall, door, label, food truck, etc.',
      'Double-click a label to edit its text inline on the canvas.',
    ],
    keywords: ['select', 'hand', 'pan', 'draw', 'move', 'pointer', 'mouse'],
  },
  {
    id: 'tools-walls-doors',
    category: 'tools',
    title: 'Walls, doors, and exits',
    summary:
      'Sketch venue architecture and mark entry/exit points for traffic-flow tools.',
    steps: [
      'Wall — solid structural segment; Open wall — pass-through divider.',
      'Door — place on a perimeter wall; use as main entrance.',
      'Exit / Emergency exit — mark egress doors on outer walls.',
      'Auto-arrange (non-grid modes) needs at least one entry and one exit on perimeter walls.',
      'Food truck — large fixture for mobile vendors.',
    ],
    keywords: [
      'wall',
      'door',
      'entrance',
      'exit',
      'emergency',
      'perimeter',
      'architecture',
      'fixture',
      'food truck',
    ],
  },
  {
    id: 'tools-history-clipboard',
    category: 'tools',
    title: 'Undo, redo, copy, and paste',
    summary: 'Standard edit operations for objects and selections.',
    steps: [
      'Undo / Redo buttons or Ctrl+Z / Ctrl+Shift+Z reverse canvas edits.',
      'Copy selected objects with Ctrl+C; paste with Ctrl+V.',
      'Ctrl+D duplicates the current selection in place.',
      'Lock all prevents accidental erasure of fixtures; Clear removes vendors and paint.',
    ],
    keywords: [
      'undo',
      'redo',
      'copy',
      'paste',
      'duplicate',
      'clipboard',
      'clear',
      'lock',
      'erase',
    ],
  },
  {
    id: 'vendors-place-booths',
    category: 'vendors',
    title: 'Place vendor booths',
    summary:
      'Vendor booths are rectangular footprints sized by table length and shared aisle rules.',
    steps: [
      'In Vendor Booths, pick a table length (6′, 8′, 10′, etc.).',
      'Click the vendor booth tool — cursor draws booth rectangles on the canvas.',
      'Each booth gets a number that syncs to applications and check-in after save.',
      'On the command center dashboard, drag approved vendors from the roster onto booths.',
    ],
    keywords: [
      'vendor',
      'booth',
      'place',
      'table length',
      'footprint',
      'assign',
      'drop vendor',
    ],
  },
  {
    id: 'vendors-sizes-overlap',
    category: 'vendors',
    title: 'Booth sizes and overlaps',
    summary:
      'Table length drives booth width; overlaps and illegal placements block saving.',
    steps: [
      'Baseline table length sets the default vendor booth width for new placements.',
      'Overlapping booths or fixtures show red highlights and an Overlaps badge in the header.',
      'Resolve every overlap before Save — the save button stays disabled until fixed.',
      'Yellow/red aisle warnings are advisory; physical overlaps are hard errors.',
    ],
    keywords: [
      'overlap',
      'collision',
      'size',
      'table size',
      '6 foot',
      '8 foot',
      'clearance',
      'warning',
    ],
  },
  {
    id: 'patrons-tables',
    category: 'patrons',
    title: 'Patron tables (round and rectangular)',
    summary:
      'Guest seating for markets with dine-in or auction tables separate from vendor booths.',
    steps: [
      'Under Patron Layout, choose Round or Rectangular guest table.',
      'Pick a length (typically 6′ or 8′) before drawing on the canvas.',
      'Patron tables use guest sizing — they do not count toward vendor booth capacity.',
      'Include patron tables when running floor-plan optimize if shoppers need seating paths.',
    ],
    keywords: [
      'patron',
      'guest',
      'round table',
      'rectangular',
      'seating',
      'dining',
      'auction table',
    ],
  },
  {
    id: 'patron-path-overlay',
    category: 'patrons',
    title: 'Patron flow paths',
    summary:
      'Visual overlay for recommended walking aisles between booths and tables.',
    steps: [
      'Toggle the Route / patron path button in the toolbar.',
      'Overlay shows ~6′ walking aisles for shopper traffic.',
      'Use alongside clearance warnings to spot bottlenecks before market day.',
      `Walkways should stay at least ${MIN_STROLLER_AISLE_WIDTH_FT}′ wide for stroller traffic.`,
    ],
    keywords: [
      'patron path',
      'flow',
      'aisle',
      'walkway',
      'route',
      'traffic',
      'stroller',
      '6 foot path',
    ],
  },
  {
    id: 'optimize-auto-arrange',
    category: 'optimize',
    title: 'Auto-arrange / optimize floor plan',
    summary:
      'Automatically position vendor booths and patron tables inside the active room.',
    steps: [
      'Place tables with Vendor Booths or Patron Tables before optimizing — generic Shapes do not count.',
      'Grid mode works without doors; Perimeter and other modes need entry + exit on walls.',
      'Choose a mode: Grid (interior rows), Perimeter (ring along walls), or Outdoor rows.',
      'Click Optimize / Auto-arrange — existing objects in the room are repositioned.',
      'Review clearance warnings and overlaps after auto-arrange; tweak manually if needed.',
    ],
    keywords: [
      'auto arrange',
      'optimize',
      'auto plan',
      'grid',
      'perimeter',
      'outdoor rows',
      'fcfs',
      'layout',
    ],
  },
  {
    id: 'optimize-align-distribute',
    category: 'optimize',
    title: 'Align and distribute objects',
    summary: 'Snap multiple selected objects into clean rows and even spacing.',
    steps: [
      'Select 2+ objects with Select tool (Shift-click for multi-select).',
      'Align vertical centers (Shift+V) or horizontal centers (Shift+H).',
      'With 3+ objects, Distribute evenly along horizontal or vertical axis.',
      'Rotate selected booths with R (15° steps) or the rotate buttons.',
    ],
    keywords: [
      'align',
      'distribute',
      'spacing',
      'center',
      'row',
      'straighten',
      'rotate',
    ],
  },
  {
    id: 'view-zoom-fullscreen',
    category: 'view',
    title: 'Zoom, center view, and fullscreen',
    summary: 'Navigate large venues without losing your place on the canvas.',
    steps: [
      'Scroll or pinch on the canvas to zoom; use +/- buttons in the toolbar.',
      'Click the zoom percentage to reset to 100%.',
      'Center view (crosshair icon) frames all placed objects.',
      'Fullscreen expands the canvas to fill the monitor; Esc exits.',
    ],
    keywords: [
      'zoom',
      'fullscreen',
      'center',
      'pan',
      'navigate',
      'viewport',
      'fit',
    ],
  },
  {
    id: 'view-labels-warnings',
    category: 'view',
    title: 'Map labels and clearance warnings',
    summary: 'Control what text and warning overlays appear on booths.',
    steps: [
      'Map labels dropdown — show vendor name, booth number, category, etc. on booths.',
      'Toggle architectural labels (eye icon) for wall and fixture text.',
      'Clearance warnings (triangle icon) highlight tight aisles near walls and fixtures.',
      'Right inspector (] toggle) shows metrics for the selected room or object.',
    ],
    keywords: [
      'labels',
      'map label',
      'vendor name',
      'booth number',
      'warning',
      'clearance',
      'inspector',
      'overlay',
    ],
  },
  {
    id: 'view-dual-screen',
    category: 'view',
    title: 'Dual-screen presenter and wall cast',
    summary:
      'Open a second display for booth matrices during load-in or announcements.',
    steps: [
      'Presenter — interactive booth matrix you can drive from a laptop.',
      'Wall Cast — read-only matrix for a projector or TV.',
      'Both views sync with the saved layout and live booth assignments.',
      'Use Presenter / Wall Cast in the toolbar (wizard Step 3, full editor, or command center).',
    ],
    keywords: [
      'dual screen',
      'presenter',
      'wall cast',
      'projector',
      'display',
      'matrix',
      'second monitor',
    ],
  },
  {
    id: 'save-draft-deploy',
    category: 'save',
    title: 'Save draft vs Save & deploy',
    summary: 'Persist layout work and publish draft markets when ready.',
    steps: [
      'Save draft — writes layout to the database without changing event status.',
      'Save layout / Save & deploy — saves and, for draft events, publishes the market.',
      'Draft deploy requires venue verification and coordinator publish gate checks.',
      'Overlaps block every save path until resolved.',
    ],
    keywords: [
      'save',
      'draft',
      'deploy',
      'publish',
      'persist',
      'button',
    ],
  },
  {
    id: 'save-layout-template',
    category: 'save',
    title: 'Saved layouts for reuse',
    summary:
      'Save your floor plan structure at a venue and optionally share it with other coordinators.',
    steps: [
      'Save layout for reuse — stores rooms, fixtures, and booth positions for this venue address.',
      'Vendor assignments are not saved — only the hall structure comes back on load.',
      'Share at this venue — makes the layout visible to other coordinators at the same location.',
      'Load saved layout — pick from Your layouts or Shared at this venue in the toolbar.',
    ],
    keywords: [
      'template',
      'reuse',
      'saved layout',
      'public',
      'share',
      'venue',
      'bookmark',
    ],
  },
  {
    id: 'save-reload-autosave',
    category: 'save',
    title: 'Reload, autosave, and local drafts',
    summary:
      'Recover server state or understand when changes are written automatically.',
    steps: [
      'Reload saved layout — discards local merge overlays and fetches server layout.',
      'Command center autosaves layout edits while you work on the dashboard.',
      'Room tabs keep unsaved work in the browser session until you save or reload.',
      'Always save before switching devices or closing the browser for long sessions.',
    ],
    keywords: [
      'reload',
      'autosave',
      'server',
      'cache',
      'refresh',
      'lost changes',
      'recover',
    ],
  },
]
