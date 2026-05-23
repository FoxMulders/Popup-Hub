'use client'

import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { autoLayoutAsync } from '@/lib/booth-planner/auto-layout-async'
import { resolveAutoPlanStrategy } from '@/lib/booth-planner/auto-plan-strategy'
import {
  storefrontLabelCssPosition,
  storefrontLabelCssTransform,
} from '@/lib/booth-planner/booth-label-layout'
import { AUTO_PLAN_CAPACITY_LIMIT_MESSAGE } from '@/lib/booth-planner/placement-guard'
import { sortVendorsFcfs } from '@/lib/applications/fcfs-sort'
import {
  createFakeVendors,
  createRandomFakeVendors,
  fakeVendorsFromCells,
  isFakeVendorId,
  TEST_CATEGORY_PRESETS,
  type FakeVendorInput,
} from '@/lib/booth-planner/fake-vendors'
import {
  blockedCellKeys,
  buildDefaultVenueElements,
  moveDoorOnWall,
  refreshPerimeterForEntranceWall,
  wallAtCell,
  buildVenueElementMap,
  displayLabel,
  fixtureCanvasLabel,
  ELEMENT_STYLES,
  isElementOrigin,
  countLockedFixtures,
  clearUserPlacedLayout,
  paintCells,
  removeElementsAt,
  setAllFixturesLocked,
  toggleElementLock,
  toggleElementLockById,
} from '@/lib/booth-planner/venue-elements'
import { FakeVendorsPanel } from '@/components/coordinator/fake-vendors-panel'
import { LayoutPresetPicker } from '@/components/coordinator/layout-preset-picker'
import { UnplacedVendorsPanel } from '@/components/coordinator/unplaced-vendors-panel'
import { GridScaleBanner } from '@/components/coordinator/grid-scale-banner'
import { VendorCategorySummary } from '@/components/coordinator/vendor-category-summary'
import { SmartPopulateBoothCaps } from '@/components/coordinator/smart-populate-booth-caps'
import { EdmontonVenueTemplateBar } from '@/components/coordinator/edmonton-venue-template-bar'
import {
  getVenuePresetById,
  getOffFloorZonesForPreset,
  hydrateVenuePreset,
  resetRoomToPresetBlueprint,
  savedVenueMatchesCurrentPreset,
  isVenuePresetId,
  resolveTemplateAnchoredDimensions,
  type VenuePresetId,
} from '@/lib/booth-planner/venue-presets'
import { TableSizeSelector } from '@/components/coordinator/table-size-selector'
import {
  DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT,
  gridSpansForTableLength,
  isLayoutBaselineTableLengthFt,
  validateBaselineTableSizeChange,
  validateTableSizeLayout,
  type LayoutBaselineTableLengthFt,
} from '@/lib/booth-planner/layout-table-size'
import {
  createCoGeneratedAisleElement,
  frontAisleRectForStorefront,
  manualCoAisleCellsAvailableForStorefront,
  removeCoAisleForBooth,
} from '@/lib/booth-planner/co-generated-aisles'
import {
  collectObstructedCellKeys,
  evaluateCompositePlacement,
} from '@/lib/booth-planner/layout-engine'
import { SpatialBitGrid } from '@/lib/booth-planner/spatial-bitmap'
import { normalizeCategoryKey } from '@/lib/booth-planner/category-isolation'
import {
  buildVendorPlacementGuard,
  vendorCategoryAdjacencyMessage,
} from '@/lib/booth-planner/vendor-placement-guards'
import { resolveVenueTableFootprint } from '@/lib/booth-planner/vendor-footprint'
import {
  normalizePlacedCellsForPathfinding,
  vendorPathfindingBlockMessage,
  vendorPathfindingUnobstructed,
} from '@/lib/booth-planner/vendor-pathfinding-guard'
import {
  effectiveStorefrontSide,
  facingTargetFromEntrance,
  inferFacingTargetAtPosition,
  facingTargetLabel,
  invertFacingTarget,
  resolveManualFacingPlacement,
  type FacingTarget,
} from '@/lib/booth-planner/facing-target'
import { lockedPerimeterSpansAtOrigin } from '@/lib/booth-planner/perimeter-orientation'
import {
  gridSpansForTableOrientation,
  inferTableOrientation,
  toggleTableOrientation,
  type TableOrientation,
} from '@/lib/booth-planner/table-orientation'
import {
  clientFrontageSide,
  fixtureGlyph,
  formatCellGlyph,
  FRONTAGE_ARROW_CLASS,
} from '@/lib/booth-planner/grid-glyphs'
import { detectLayoutOverlaps, OVERLAP_RULE_FAILURE_MESSAGE } from '@/lib/booth-planner/layout-overlap'
import { DismissibleAlertCard } from '@/components/coordinator/dismissible-alert-card'
import { MarketFeedbackAdminPanel } from '@/components/coordinator/market-feedback-admin-panel'
import { MarketFeedbackWidget } from '@/components/coordinator/market-feedback-widget'
import type { Category } from '@/types/database'
import type { CategoryLimit } from '@/components/coordinator/category-limit-editor'
import { formatBoothFootprint } from '@/lib/booth-planner/grid-scale'
import { summarizeVendorsByCategory } from '@/lib/booth-planner/vendor-category-summary'
import { nextBoothNumber, syncCellsWithVendors } from '@/lib/booth-planner/vendor-cells'
import { LayoutRoomBar } from '@/components/coordinator/layout-room-bar'
import { LAYOUT_PRESET_OPTIONS, type LayoutPreset, genericRowLayoutModeFromPreset } from '@/lib/booth-planner/layout-presets'
import {
  applyOutsideOnlyLayout,
  buildOutsideOnlyVenueElements,
} from '@/lib/booth-planner/outside-only-layout'
import { applyOutdoorMarketLayout } from '@/lib/booth-planner/outdoor-market-shell'
import {
  applyIndoorCorridorLayout,
} from '@/lib/booth-planner/indoor-corridor-layout'
import {
  generateDiverseSeedFakeVendors,
  groupSeedFakeVendorsForAutoPlan,
} from '@/lib/booth-planner/seed-vendor-applications'
import {
  buildMultiSlotMembersFromApprovedApps,
  groupMultiSlotTableVendorsForPlan,
} from '@/lib/booth-planner/approved-application-groups'
import { mergeSafetyBlockedKeys } from '@/lib/booth-planner/placement-safety-zones'
import { applyAlignedGridLayout } from '@/lib/booth-planner/aligned-grid-layout'
import { applyLShapeCornersLayout } from '@/lib/booth-planner/l-shape-corners-layout'
import { applyGenericRowLayout } from '@/lib/booth-planner/generic-row-layouts'
import {
  computeDualRingOverlay,
  type DualRingOverlayResult,
} from '@/lib/booth-planner/clearance-ring-overlay'
import { snapBoothToColumn } from '@/lib/booth-planner/column-wrap-snap'
import {
  hallHasIndoorShell,
  isIndoorVenueProfile,
  TENT_OUTDOOR_ONLY_TOOLTIP,
} from '@/lib/booth-planner/indoor-shell'
import { computePatronPathTrace } from '@/lib/booth-planner/patron-path-trace'
import { SvgPatronFlowLayer } from '@/components/coordinator/svg-patron-flow-layer'
import { isPerimeterWallElement } from '@/lib/booth-planner/perimeter-wall-segments'
import {
  resolveVendorGridSpans,
  tentVendorsAllowed,
  vendorUnitLabel,
  isTentVendor,
  type VendorUnitType,
} from '@/lib/booth-planner/vendor-unit-types'
import { StrollerClearancePanel } from '@/components/coordinator/stroller-clearance-panel'
import { TableVendorSpacingPanel } from '@/components/coordinator/table-vendor-spacing-panel'
import {
  createLayoutRoom,
  getActiveRoom,
  layoutPayloadFromRooms,
  roomsFromBoothLayout,
  updateRoomInList,
  type LayoutRoom,
} from '@/lib/booth-planner/layout-rooms'
import { analyzeStrollerClearance } from '@/lib/booth-planner/stroller-clearance'
import {
  TABLE_GRID_CELL_LENGTH_FT,
  TABLE_GRID_CELL_WIDTH_FT,
  tableFootprintToGridSpans,
  marketUnitGridSpans,
  type LayoutSpacingMode,
} from '@/lib/booth-planner/table-space'
import {
  resolveGridConfig,
  HIGH_RES_GRID_CELL_WARN_THRESHOLD,
} from '@/lib/booth-planner/grid-config'
import { resolveVenueElementsForCanvas } from '@/lib/booth-planner/resolve-venue-elements'
import {
  pushHistory,
  redoHistory,
  undoHistory,
  type LayoutHistoryState,
  type PlannerSnapshot,
} from '@/lib/booth-planner/layout-history'
import { gridCellTooltip } from '@/lib/booth-planner/layout-tool-shortcuts'
import { useLayoutKeyboardShortcuts } from '@/lib/booth-planner/use-layout-keyboard-shortcuts'
import {
  estimateMaxVendorsFit,
  runTestLayoutFill,
} from '@/lib/booth-planner/test-layout-fill'
import {
  boothUnitFootprint,
  calculateMaxBoothCapacity,
  calculateNetUsableFloorSpace,
} from '@/lib/booth-planner/smart-populate-booth-caps'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VenueFixturesCatalog } from '@/components/coordinator/venue-layout-legend'
import { CanvasUtilityToolbar } from '@/components/coordinator/canvas-utility-toolbar'
import type { LayoutTool } from '@/lib/booth-planner/layout-tool-shortcuts'
import { VirtualizedLayoutCanvas } from '@/components/coordinator/virtualized-layout-canvas'
import { SvgLayoutCanvas, SVG_FOOT_PX } from '@/components/coordinator/svg-layout-canvas'
import { canvasRowsWithAnnex } from '@/lib/booth-planner/off-floor-zones'
import { SvgInteractiveGrid } from '@/components/coordinator/svg-interactive-grid'
import { SvgTemplateLayer } from '@/components/coordinator/svg-template-layer'
import { TooltipWrapper } from '@/components/coordinator/tooltip-wrapper'
import {
  WIZARD_SECTION_LABEL,
  WIZARD_STEP_TITLE,
  WIZARD_SUMMARY_META_LABEL,
  WIZARD_SUMMARY_VALUE,
  WIZARD_SUMMARY_VALUE_EMPHASIS,
  WIZARD_SUMMARY_VALUE_SAGE,
  WIZARD_SUMMARY_VALUE_WARN,
} from '@/lib/wizard/wizard-panel-styles'
import { useLiveLayoutQa } from '@/lib/booth-planner/use-live-layout-qa'
import type { LiveLayoutQaResult } from '@/lib/booth-planner/live-layout-qa'
import { PureLayoutPreview } from '@/components/coordinator/pure-layout-preview'
import { LayoutQaLogPanel } from '@/components/coordinator/layout-qa-log-panel'
import {
  LayoutPlannerStepper,
  LayoutPlannerWizardNav,
  type LayoutPlannerStep,
} from '@/components/coordinator/layout-planner-stepper'
import { MarketStallIcon } from '@/components/coordinator/market-stall-icon'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { QuadrantBounds } from '@/lib/booth-planner/quadrant-grid'
import { toast } from 'sonner'
import {
  ArrowDown,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  ArrowUpDown,
  Wand2,
  FlaskConical,
  Save,
  Trash2,
  Zap,
  DoorOpen,
  LogOut,
  X,
  Bath,
  UtensilsCrossed,
  Armchair,
  Mic2,
  Truck,
  Package,
  Info,
  HandHeart,
  Circle,
  Tag,
  LayoutGrid,
  Lock,
  LockOpen,
  RotateCw,
  Route,
} from 'lucide-react'
import type { BoothCell, BoothLayout, VenueElement, VenueElementType } from '@/types/database'

const CATEGORY_COLORS = [
  'bg-sage-100 border-sage-300 text-sage-800',
  'bg-harvest-100 border-harvest-300 text-harvest-800',
  'bg-canvas border-stone-300 text-foreground',
  'bg-harvest-50 border-harvest-200 text-harvest-800',
  'bg-terracotta-50 border-terracotta-200 text-terracotta-800',
  'bg-sage-50 border-sage-200 text-sage-900',
  'bg-linen border-stone-200 text-espresso',
  'bg-forest/10 border-forest/30 text-forest',
]

function categoryColorClass(categoryName: string): string {
  let hash = 0
  for (let i = 0; i < categoryName.length; i++) {
    hash = (hash * 31 + categoryName.charCodeAt(i)) & 0xffffffff
  }
  return CATEGORY_COLORS[Math.abs(hash) % CATEGORY_COLORS.length]
}

function layoutBoothLabel(boothNumber: number | null | undefined): string {
  return boothNumber != null && boothNumber > 0 ? `#${boothNumber}` : 'Unassigned'
}

const ELEMENT_ICONS: Partial<Record<VenueElementType, React.ComponentType<{ className?: string }>>> = {
  entrance: DoorOpen,
  door: DoorOpen,
  exit: LogOut,
  aisle: LayoutGrid,
  restroom: Bath,
  food_court: UtensilsCrossed,
  seating: Armchair,
  stage: Mic2,
  loading_dock: Truck,
  storage: Package,
  info_desk: Info,
  welcome_booth: HandHeart,
  column: Circle,
  custom_label: Tag,
}

interface ApplicationInput {
  id: string
  vendor_id?: string
  category_id: string
  vendor: { full_name: string }
  passport: { business_name: string } | null
  category: { name: string } | null
  booth_number: number | null
  status: string
  table_length_ft: number | null
  requested_booth_type?: 'inside' | 'wall' | 'power' | 'any' | null
  applied_at?: string
  neighbor_preference?: string | null
}

export interface BoothPlannerProps {
  eventId: string
  existingLayout: BoothLayout | null
  applications: ApplicationInput[]
  categoryTableLengths?: Record<string, number | null>
  /** Category names allowed for this event (shows 0 when none in roster yet). */
  eventCategoryNames?: string[]
  allCategories?: Category[]
  allowMlm?: boolean
  /** When true, render only the interactive canvas workspace (wizard step 4 embed). */
  canvasOnly?: boolean
  hideInternalNav?: boolean
  /** Parent-owned room list (wizard) — keeps autosave and room tabs in sync. */
  layoutRooms?: LayoutRoom[]
  layoutActiveRoomId?: string
  onLayoutRoomsChange?: (rooms: LayoutRoom[], activeRoomId: string) => void
  /** Hide the built-in room bar when the parent renders LayoutRoomBar. */
  hideRoomBar?: boolean
  saveLayoutRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  autoPlanRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  saveBlankLayoutRef?: React.MutableRefObject<(() => Promise<boolean>) | null>
  onOverlapChange?: (hasOverlap: boolean) => void
  onLiveQaChange?: (state: {
    live: LiveLayoutQaResult | null
    qaRunning: boolean
  }) => void
}

const DEFAULT_TABLE_LENGTH_FT = DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT

const ENTRANCE_OPTIONS = [
  { value: 'north' as const, label: 'North', Icon: ArrowUp },
  { value: 'south' as const, label: 'South', Icon: ArrowDown },
  { value: 'east' as const, label: 'East', Icon: ArrowRight },
  { value: 'west' as const, label: 'West', Icon: ArrowLeft },
]


export function BoothPlanner({
  eventId,
  existingLayout,
  applications,
  categoryTableLengths = {},
  eventCategoryNames = [],
  allCategories = [],
  allowMlm = false,
  canvasOnly = false,
  hideInternalNav = false,
  layoutRooms: controlledRooms,
  layoutActiveRoomId: controlledActiveRoomId,
  onLayoutRoomsChange,
  hideRoomBar = false,
  saveLayoutRef,
  autoPlanRef,
  saveBlankLayoutRef,
  onOverlapChange,
  onLiveQaChange,
}: BoothPlannerProps) {
  const supabase = createClient()

  const initialRoomsState = useMemo(
    () => roomsFromBoothLayout(existingLayout),
    [existingLayout]
  )

  const roomsControlled = controlledRooms != null && onLayoutRoomsChange != null
  const [internalRooms, setInternalRooms] = useState<LayoutRoom[]>(initialRoomsState.rooms)
  const [internalActiveRoomId, setInternalActiveRoomId] = useState(initialRoomsState.activeRoomId)
  const rooms = roomsControlled ? controlledRooms! : internalRooms
  const activeRoomId = roomsControlled
    ? (controlledActiveRoomId ?? controlledRooms![0]?.id ?? '')
    : internalActiveRoomId

  const setRooms = useCallback(
    (action: LayoutRoom[] | ((prev: LayoutRoom[]) => LayoutRoom[])) => {
      if (roomsControlled) {
        const next = typeof action === 'function' ? action(controlledRooms!) : action
        onLayoutRoomsChange!(next, controlledActiveRoomId ?? next[0]?.id ?? '')
        return
      }
      setInternalRooms(action)
    },
    [roomsControlled, controlledRooms, controlledActiveRoomId, onLayoutRoomsChange]
  )

  const setActiveRoomId = useCallback(
    (roomId: string) => {
      if (roomsControlled) {
        onLayoutRoomsChange!(controlledRooms!, roomId)
        return
      }
      setInternalActiveRoomId(roomId)
    },
    [roomsControlled, controlledRooms, onLayoutRoomsChange]
  )

  const commitRoomsChange = useCallback(
    (nextRooms: LayoutRoom[], nextActiveRoomId: string = activeRoomId) => {
      if (roomsControlled) {
        onLayoutRoomsChange!(nextRooms, nextActiveRoomId)
        return
      }
      setInternalRooms(nextRooms)
      setInternalActiveRoomId(nextActiveRoomId)
    },
    [roomsControlled, activeRoomId, onLayoutRoomsChange]
  )

  const [venuePresetId, setVenuePresetId] = useState<VenuePresetId>('blank')

  const activeRoom = useMemo(
    () => getActiveRoom(rooms, activeRoomId),
    [rooms, activeRoomId]
  )

  function handleSelectRoom(roomId: string) {
    setActiveRoomId(roomId)
  }

  function handleAddRoom() {
    const room = createLayoutRoom(
      rooms.length === 0 ? 'Main Hall' : `Room ${rooms.length + 1}`
    )
    commitRoomsChange([...rooms, room], room.id)
    toast.success(`Added ${room.name}`)
  }

  function handleRenameRoom(roomId: string, name: string) {
    setRooms((prev) => updateRoomInList(prev, roomId, { name }))
  }

  function handleDeleteRoom(roomId: string) {
    if (rooms.length <= 1) {
      toast.error('At least one room is required')
      return
    }
    const room = rooms.find((r) => r.id === roomId)
    if (
      !window.confirm(
        `Delete "${room?.name ?? 'this room'}"? Its booths and fixtures will be removed.`
      )
    ) {
      return
    }
    const next = rooms.filter((r) => r.id !== roomId)
    commitRoomsChange(next, activeRoomId === roomId ? next[0]!.id : activeRoomId)
    toast.message('Room deleted')
  }

  const {
    venue_width: venueWidth,
    venue_length: venueLength,
    booth_width: boothWidth,
    booth_length: boothLength,
    entrance,
    spacing_mode: spacingMode,
    baseline_table_length_ft: roomBaselineTableLengthFt,
    cells,
    venue_elements: venueElements,
    venue_preset_id: roomVenuePresetId,
  } = activeRoom

  const activeTemplateId: VenuePresetId = isVenuePresetId(roomVenuePresetId)
    ? roomVenuePresetId
    : venuePresetId

  const templateAnchor = useMemo(
    () => resolveTemplateAnchoredDimensions(activeTemplateId, venueWidth, venueLength),
    [activeTemplateId, venueWidth, venueLength]
  )

  useEffect(() => {
    const next: VenuePresetId = isVenuePresetId(roomVenuePresetId) ? roomVenuePresetId : 'blank'
    setVenuePresetId(next)
  }, [activeRoomId, roomVenuePresetId])

  const baselineTableLengthFt: LayoutBaselineTableLengthFt = useMemo(() => {
    if (
      roomBaselineTableLengthFt != null &&
      isLayoutBaselineTableLengthFt(roomBaselineTableLengthFt)
    ) {
      return roomBaselineTableLengthFt
    }
    return DEFAULT_LAYOUT_BASELINE_TABLE_LENGTH_FT
  }, [roomBaselineTableLengthFt])

  const [vendorTableLengths, setVendorTableLengths] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const app of applications) {
      if (app.status !== 'approved') continue
      const ft =
        app.table_length_ft ??
        categoryTableLengths[app.category_id] ??
        DEFAULT_TABLE_LENGTH_FT
      map[app.id] = ft
    }
    return map
  })
  const [vendorTableOrientations, setVendorTableOrientations] = useState<
    Record<string, TableOrientation>
  >(() => {
    const map: Record<string, TableOrientation> = {}
    for (const cell of initialRoomsState.rooms.flatMap((r) => r.cells)) {
      if (cell.tableOrientation) map[cell.id] = cell.tableOrientation
    }
    return map
  })
  const [fakeVendors, setFakeVendors] = useState<FakeVendorInput[]>(() =>
    fakeVendorsFromCells(
      initialRoomsState.rooms.flatMap((r) => r.cells)
    )
  )
  const [activeTool, setActiveTool] = useState<LayoutTool>('vendor')
  const [manualFacingTarget, setManualFacingTarget] = useState<FacingTarget>(() =>
    facingTargetFromEntrance(initialRoomsState.rooms[0]?.entrance ?? 'south')
  )
  const [facingAutoMode, setFacingAutoMode] = useState(true)
  const [hoverSuggestedFacing, setHoverSuggestedFacing] = useState<FacingTarget | null>(null)
  const [layoutPreset, setLayoutPreset] = useState<LayoutPreset>('default')
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null)
  const [layoutHiddenIds, setLayoutHiddenIds] = useState<Set<string>>(() => new Set())
  const [lastFillSummary, setLastFillSummary] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [customLabelDraft, setCustomLabelDraft] = useState('')
  const [clearCanvasOpen, setClearCanvasOpen] = useState(false)
  const [feedbackRefreshToken, setFeedbackRefreshToken] = useState(0)
  const [autoPlanRunning, setAutoPlanRunning] = useState(false)
  const [randomFillRunning, setRandomFillRunning] = useState(false)
  const [seedFillRunning, setSeedFillRunning] = useState(false)
  const [showPatronFlow, setShowPatronFlow] = useState(false)
  const autoPlanAbortRef = useRef(false)
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => new Set())
  const [layoutAlert, setLayoutAlert] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<LayoutPlannerStep>(canvasOnly ? 3 : 1)
  const [maxReachableStep, setMaxReachableStep] = useState<LayoutPlannerStep>(canvasOnly ? 4 : 1)

  const canvasMounted = canvasOnly || currentStep === 3

  useEffect(() => {
    const room = getActiveRoom(rooms, activeRoomId)
    if (room.venue_elements.length > 0 || room.cells.some((c) => c.col >= 0)) {
      setMaxReachableStep(4)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial saved-layout reachability only
  }, [])

  const [layoutHistory, setLayoutHistory] = useState<LayoutHistoryState>({ past: [], future: [] })
  const suppressHistoryRef = useRef(false)
  const isInitializingRef = useRef(false)

  const plannerStateRef = useRef({
    rooms,
    activeRoomId,
    fakeVendors,
    vendorTableLengths,
    vendorTableOrientations,
  })
  plannerStateRef.current = {
    rooms,
    activeRoomId,
    fakeVendors,
    vendorTableLengths,
    vendorTableOrientations,
  }

  const makeSnapshot = useCallback((): PlannerSnapshot => {
    const state = plannerStateRef.current
    return structuredClone({
      rooms: state.rooms,
      activeRoomId: state.activeRoomId,
      fakeVendors: state.fakeVendors,
      vendorTableLengths: state.vendorTableLengths,
      vendorTableOrientations: state.vendorTableOrientations,
    })
  }, [])

  const recordHistory = useCallback(() => {
    if (suppressHistoryRef.current || isInitializingRef.current) return
    setLayoutHistory((h) => pushHistory(h, makeSnapshot()))
  }, [makeSnapshot])

  const applySnapshot = useCallback((snapshot: PlannerSnapshot) => {
    suppressHistoryRef.current = true
    commitRoomsChange(snapshot.rooms, snapshot.activeRoomId)
    setFakeVendors(snapshot.fakeVendors)
    setVendorTableLengths(snapshot.vendorTableLengths)
    setVendorTableOrientations(snapshot.vendorTableOrientations ?? {})
    suppressHistoryRef.current = false
  }, [commitRoomsChange])

  const handleUndo = useCallback(() => {
    const current = makeSnapshot()
    let nextSnapshot: PlannerSnapshot | null = null
    setLayoutHistory((h) => {
      const result = undoHistory(h, current)
      nextSnapshot = result.snapshot
      return result.history
    })
    if (nextSnapshot) applySnapshot(nextSnapshot)
  }, [makeSnapshot, applySnapshot])

  const handleRedo = useCallback(() => {
    const current = makeSnapshot()
    let nextSnapshot: PlannerSnapshot | null = null
    setLayoutHistory((h) => {
      const result = redoHistory(h, current)
      nextSnapshot = result.snapshot
      return result.history
    })
    if (nextSnapshot) applySnapshot(nextSnapshot)
  }, [makeSnapshot, applySnapshot])

  const patchActiveRoom = useCallback(
    (patch: Partial<LayoutRoom>) => {
      if (!suppressHistoryRef.current && !isInitializingRef.current) {
        recordHistory()
      }
      setRooms((prev) => updateRoomInList(prev, activeRoomId, patch))
    },
    [activeRoomId, recordHistory]
  )

  const patchActiveRoomFn = useCallback(
    (fn: (room: LayoutRoom) => Partial<LayoutRoom>) => {
      setRooms((prev) => {
        const current = getActiveRoom(prev, activeRoomId)
        return updateRoomInList(prev, activeRoomId, fn(current))
      })
    },
    [activeRoomId]
  )

  const lastHydratedTemplateKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (isInitializingRef.current) return
    if (!templateAnchor.isAnchored || !templateAnchor.preset) return
    if (
      venueWidth === templateAnchor.width &&
      venueLength === templateAnchor.length &&
      spacingMode === 'one_foot' &&
      boothWidth === 1 &&
      boothLength === 1
    ) {
      return
    }
    suppressHistoryRef.current = true
    setRooms((prev) =>
      updateRoomInList(prev, activeRoomId, {
        venue_width: templateAnchor.width,
        venue_length: templateAnchor.length,
        booth_width: 1,
        booth_length: 1,
        spacing_mode: 'one_foot',
      })
    )
    suppressHistoryRef.current = false
  }, [
    activeRoomId,
    activeTemplateId,
    templateAnchor.isAnchored,
    templateAnchor.width,
    templateAnchor.length,
    venueWidth,
    venueLength,
    spacingMode,
    boothWidth,
    boothLength,
  ])

  type DragSource =
    | { kind: 'grid'; col: number; row: number }
    | { kind: 'unplaced'; cellId: string }
    | { kind: 'door'; doorType: 'entrance' | 'exit' }

  const dragSource = useRef<DragSource | null>(null)
  const isPainting = useRef(false)
  const placementBlockReason = useRef<string | null>(null)
  const paintLabelRef = useRef<string | undefined>(undefined)

  /** Hydrate canvas from a hall template — fires only when template selection changes. */
  useEffect(() => {
    const hydrationKey = `${activeRoomId}:${activeTemplateId}`

    if (activeTemplateId === 'blank') {
      lastHydratedTemplateKeyRef.current = hydrationKey
      return
    }

    if (lastHydratedTemplateKeyRef.current === hydrationKey) return

    const preset = getVenuePresetById(activeTemplateId)
    if (!preset) return

    // Room already carries this template's painted fixtures (e.g. saved layout).
    if (
      roomVenuePresetId === activeTemplateId &&
      venueElements.length > 0 &&
      venueWidth === preset.canvasWidth &&
      venueLength === preset.canvasHeight &&
      savedVenueMatchesCurrentPreset(
        venueElements,
        activeTemplateId,
        venueWidth,
        venueLength
      )
    ) {
      lastHydratedTemplateKeyRef.current = hydrationKey
      return
    }

    if (
      roomVenuePresetId === activeTemplateId &&
      venueElements.length > 0 &&
      !savedVenueMatchesCurrentPreset(
        venueElements,
        activeTemplateId,
        venueWidth,
        venueLength
      )
    ) {
      toast.message('Venue template updated — floor plan refreshed to current hall layout', {
        duration: 4000,
      })
    }

    lastHydratedTemplateKeyRef.current = hydrationKey
    isInitializingRef.current = true
    suppressHistoryRef.current = true

    setFakeVendors([])
    setRooms((prev) =>
      updateRoomInList(prev, activeRoomId, {
        cells: [],
        venue_elements: [],
        venue_preset_id: null,
        ...hydrateVenuePreset(activeTemplateId),
      })
    )

    const timer = window.setTimeout(() => {
      isInitializingRef.current = false
      suppressHistoryRef.current = false
    }, 0)

    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only re-hydrate on template id change
  }, [activeTemplateId])

  const gridConfig = useMemo(
    () =>
      resolveGridConfig({
        venueWidthFt: templateAnchor.width,
        venueLengthFt: templateAnchor.length,
        boothWidthFt: boothWidth,
        boothLengthFt: boothLength,
        spacingMode,
      }),
    [templateAnchor.width, templateAnchor.length, boothWidth, boothLength, spacingMode]
  )
  const gridCols = gridConfig.cols
  const gridRows = gridConfig.rows
  const cellPx = gridConfig.cellPx
  const offFloorZones = useMemo(
    () => getOffFloorZonesForPreset(activeTemplateId),
    [activeTemplateId]
  )
  const canvasRows = useMemo(
    () => canvasRowsWithAnnex(gridRows, offFloorZones),
    [gridRows, offFloorZones]
  )
  const venueElementsWithDoors = useMemo(
    () => resolveVenueElementsForCanvas(venueElements, entrance, gridCols, gridRows),
    [venueElements, entrance, gridCols, gridRows]
  )

  const blocked = useMemo(
    () =>
      mergeSafetyBlockedKeys(
        blockedCellKeys(venueElementsWithDoors),
        venueElementsWithDoors,
        gridCols,
        canvasRows,
        gridRows
      ),
    [venueElementsWithDoors, gridCols, canvasRows, gridRows]
  )
  const obstructed = useMemo(
    () => collectObstructedCellKeys(venueElementsWithDoors, gridCols, gridRows),
    [venueElementsWithDoors, gridCols, gridRows]
  )
  const occupiedBoothKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const cell of cells) {
      if (cell.col < 0) continue
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          keys.add(`${cell.row + dr}-${cell.col + dc}`)
        }
      }
    }
    return keys
  }, [cells])
  const venueMap = useMemo(() => buildVenueElementMap(venueElementsWithDoors), [venueElementsWithDoors])
  const lockedFixtureCount = useMemo(
    () => countLockedFixtures(venueElements),
    [venueElements]
  )
  const allFixturesLocked = useMemo(
    () => venueElements.length > 0 && lockedFixtureCount === venueElements.length,
    [venueElements.length, lockedFixtureCount]
  )

  const strollerClearance = useMemo(
    () =>
      analyzeStrollerClearance({
        rows: gridRows,
        cols: gridCols,
        boothWidthFt: gridConfig.cellWidthFt,
        boothLengthFt: gridConfig.cellLengthFt,
        cells,
        venueElements: venueElementsWithDoors,
      }),
    [gridRows, gridCols, gridConfig.cellWidthFt, gridConfig.cellLengthFt, cells, venueElementsWithDoors]
  )

  const patronPathTrace = useMemo(
    () =>
      computePatronPathTrace(venueElementsWithDoors, gridCols, gridRows, entrance, {
        placedCells: normalizePlacedCellsForPathfinding(
          cells.filter((c) => c.col >= 0),
          spacingMode,
          baselineTableLengthFt
        ),
      }),
    [venueElementsWithDoors, gridCols, gridRows, entrance, cells, spacingMode, baselineTableLengthFt]
  )

  const hasPatronPath = patronPathTrace != null && patronPathTrace.points.length >= 2

  const bottleneckFingerprint = useMemo(
    () => [...strollerClearance.bottleneckKeys].sort().join('|'),
    [strollerClearance.bottleneckKeys]
  )

  useEffect(() => {
    setDismissedAlerts((prev) => {
      if (!prev.has('stroller-bottleneck')) return prev
      const next = new Set(prev)
      next.delete('stroller-bottleneck')
      return next
    })
  }, [bottleneckFingerprint])

  const dismissAlert = useCallback((alertId: string) => {
    setDismissedAlerts((prev) => new Set(prev).add(alertId))
  }, [])

  const showStrollerOverlays =
    strollerClearance.hasBottleneck && !dismissedAlerts.has('stroller-bottleneck')

  const layoutOverlaps = useMemo(
    () =>
      detectLayoutOverlaps({
        cells,
        rows: gridRows,
        cols: gridCols,
        venueElements: venueElementsWithDoors,
      }),
    [cells, gridRows, gridCols, venueElementsWithDoors]
  )

  const overlapFingerprint = useMemo(
    () => [...layoutOverlaps.overlapKeys].sort().join('|'),
    [layoutOverlaps.overlapKeys]
  )

  useEffect(() => {
    if (!overlapFingerprint) return
    setDismissedAlerts((prev) => {
      if (!prev.has('overlap-booth')) return prev
      const next = new Set(prev)
      next.delete('overlap-booth')
      return next
    })
  }, [overlapFingerprint])

  const showOverlapCard =
    layoutOverlaps.hasOverlap && !dismissedAlerts.has('overlap-booth')

  const liveLayoutQa = useLiveLayoutQa(
    {
      cells,
      venueElements: venueElementsWithDoors,
      rows: gridRows,
      cols: gridCols,
      cellWidthFt: gridConfig.cellWidthFt,
      cellLengthFt: gridConfig.cellLengthFt,
    },
    {
      enabled: canvasMounted,
      // Live overlap/stroller desk only — full 100-scenario regression is manual via Layout QA panel.
      runRegression: false,
    }
  )

  useEffect(() => {
    onLiveQaChange?.({
      live: liveLayoutQa.live,
      qaRunning: liveLayoutQa.qaRunning,
    })
  }, [liveLayoutQa.live, liveLayoutQa.qaRunning, onLiveQaChange])

  const [capacityAlertVisible, setCapacityAlertVisible] = useState(false)
  const [capacityAlertMessage, setCapacityAlertMessage] = useState<string | null>(null)

  const cellMap = useMemo(() => {
    const map = new Map<string, BoothCell>()
    for (const cell of cells) {
      if (cell.col >= 0 && cell.row >= 0) {
        for (let r = cell.row; r < cell.row + cell.rowSpan; r++) {
          for (let c = cell.col; c < cell.col + cell.colSpan; c++) {
            map.set(`${r}-${c}`, cell)
          }
        }
      }
    }
    return map
  }, [cells])

  const overflow = useMemo(() => cells.filter((c) => c.col < 0), [cells])
  const placed = useMemo(() => cells.filter((c) => c.col >= 0), [cells])

  const layoutCells = useMemo(
    () => cells.filter((c) => !layoutHiddenIds.has(c.id)),
    [cells, layoutHiddenIds]
  )

  const categorySummaries = useMemo(
    () => summarizeVendorsByCategory(layoutCells, eventCategoryNames),
    [layoutCells, eventCategoryNames]
  )

  const layoutCapacity = useMemo(
    () =>
      estimateMaxVendorsFit({
        venueWidth,
        venueLength,
        boothWidth,
        boothLength,
        entrance,
        spacingMode,
        preset: layoutPreset,
        categoryNames: eventCategoryNames,
        categoryColor: categoryColorClass,
      }),
    [
      venueWidth,
      venueLength,
      boothWidth,
      boothLength,
      entrance,
      spacingMode,
      layoutPreset,
      eventCategoryNames,
    ]
  )

  const maxBoothCapacity = useMemo(() => {
    if (venueWidth <= 0 || venueLength <= 0) return 0
    const floor = calculateNetUsableFloorSpace(venueWidth, venueLength, {
      venueElements: venueElementsWithDoors,
      entrance,
    })
    const unit = boothUnitFootprint(baselineTableLengthFt)
    return calculateMaxBoothCapacity(floor.netUsableSqFt, unit.sqFt)
  }, [venueWidth, venueLength, venueElementsWithDoors, entrance, baselineTableLengthFt])

  const isOneFootGrid = spacingMode === 'one_foot'
  const isTableSpacing = spacingMode === 'table_provided'
  const usesTableUnits = isTableSpacing || isOneFootGrid
  const isIndoorVenue = useMemo(
    () => isIndoorVenueProfile(venuePresetId, venueElementsWithDoors, gridCols, gridRows),
    [venuePresetId, venueElementsWithDoors, gridCols, gridRows]
  )
  const allowsTentVendors = tentVendorsAllowed(layoutPreset, spacingMode, isIndoorVenue)

  useEffect(() => {
    if (allowsTentVendors) return
    setFakeVendors((prev) => {
      const next = prev.filter((v) => v.vendorUnitType !== 'tent')
      return next.length === prev.length ? prev : next
    })
  }, [allowsTentVendors])

  useEffect(() => {
    if (gridConfig.totalCells > HIGH_RES_GRID_CELL_WARN_THRESHOLD) {
      toast.warning(
        `Large 1′ grid (${gridConfig.totalCells.toLocaleString()} cells). Pan/zoom may be slower on tablets — consider a smaller room zone or standard spacing for drafts.`,
        { id: 'grid-size-warn', duration: 8000 }
      )
    }
  }, [gridConfig.totalCells])

  const handleToggleLockAll = useCallback(() => {
    const lock = !allFixturesLocked
    patchActiveRoom({ venue_elements: setAllFixturesLocked(venueElements, lock) })
    toast.success(lock ? 'All fixtures locked' : 'All fixtures unlocked')
  }, [allFixturesLocked, patchActiveRoom, venueElements])

  useLayoutKeyboardShortcuts({
    onUndo: handleUndo,
    onRedo: handleRedo,
    onClearLayout: () => setClearCanvasOpen(true),
    onToggleLockAll: handleToggleLockAll,
    onToolChange: setActiveTool,
  })
  const approvedApps = applications.filter((a) => a.status === 'approved')

  function resolveTableLengthFt(_app: ApplicationInput): number {
    return baselineTableLengthFt
  }

  function resolveTableOrientation(
    id: string,
    cell?: BoothCell | null
  ): TableOrientation | undefined {
    return vendorTableOrientations[id] ?? cell?.tableOrientation ?? undefined
  }

  type VendorPlanInput = {
    id: string
    vendorName: string
    categoryName: string
    categoryColor: string
    colSpan: number
    rowSpan: number
    vendorUnitType: VendorUnitType
    tableLengthFt: number | null
    tableOrientation: TableOrientation | null
    requestedBoothType: ApplicationInput['requested_booth_type'] | null
    categoryId: string | null
  }

  function buildVendorInput(
    id: string,
    vendorName: string,
    categoryName: string,
    tableLengthFt?: number,
    categoryId?: string | null,
    vendorUnitType?: VendorUnitType,
    tableOrientation?: TableOrientation | null,
    requestedBoothType?: ApplicationInput['requested_booth_type']
  ): VendorPlanInput {
    const color = categoryColorClass(categoryName)
    const baseMeta = { categoryId: categoryId ?? null }
    const existingCell = cells.find((c) => c.id === id)
    const placed = existingCell != null && existingCell.col >= 0
    const orientation = placed
      ? (tableOrientation ?? resolveTableOrientation(id, existingCell) ?? null)
      : null
    const spans = resolveVendorGridSpans({
      unitType: vendorUnitType,
      tableLengthFt,
      spacingMode,
      tableOrientation: orientation,
    })
    return {
      id,
      vendorName,
      categoryName,
      categoryColor: color,
      colSpan: spans.colSpan,
      rowSpan: spans.rowSpan,
      vendorUnitType: spans.vendorUnitType,
      tableLengthFt: spans.tableLengthFt,
      tableOrientation: orientation,
      requestedBoothType: requestedBoothType ?? null,
      ...baseMeta,
    }
  }

  const vendorAppCount = new Map<string, number>()
  for (const app of approvedApps) {
    const groupKey = app.vendor_id ?? app.vendor.full_name
    vendorAppCount.set(groupKey, (vendorAppCount.get(groupKey) ?? 0) + 1)
  }

  let realVendorInputs: VendorPlanInput[]
  if (usesTableUnits) {
    const members = buildMultiSlotMembersFromApprovedApps(approvedApps, resolveTableLengthFt)
    const grouped = groupMultiSlotTableVendorsForPlan(members, (tableLengthFt) =>
      resolveVendorGridSpans({
        unitType: 'table',
        tableLengthFt,
        spacingMode,
      })
    )
    realVendorInputs = grouped.map((group) => {
      const base = buildVendorInput(
        group.id,
        group.vendorName,
        group.categoryName,
        group.tableLengthFt,
        group.categoryId,
        group.vendorUnitType,
        undefined,
        group.requestedBoothType
      )
      return { ...base, colSpan: group.colSpan, rowSpan: group.rowSpan }
    })
  } else {
    const seenVendors = new Set<string>()
    realVendorInputs = approvedApps
      .filter((app) => {
        const groupKey = app.vendor_id ?? app.vendor.full_name
        if (seenVendors.has(groupKey)) return false
        seenVendors.add(groupKey)
        return true
      })
      .map((app) => {
        const name = app.passport?.business_name ?? app.vendor.full_name
        const catName = app.category?.name ?? 'Uncategorized'
        const groupKey = app.vendor_id ?? app.vendor.full_name
        const count = vendorAppCount.get(groupKey) ?? 1
        const base = buildVendorInput(app.id, name, catName, undefined, app.category_id)
        return { ...base, colSpan: count, rowSpan: 1 }
      })
  }

  const fakeVendorInputs = fakeVendors.map((v) =>
    buildVendorInput(
      v.id,
      v.vendorName,
      v.categoryName,
      v.tableLengthFt ?? baselineTableLengthFt,
      null,
      v.vendorUnitType,
      v.tableOrientation,
      v.requestedBoothType
    )
  )

  const vendorInputs = [...realVendorInputs, ...fakeVendorInputs]

  function buildAutoPlanVendorQueueFromFake(fake: FakeVendorInput[]) {
    const grouped = groupSeedFakeVendorsForAutoPlan(fake, baselineTableLengthFt)
    const fakeForPlan = grouped.map((g) => {
      const lead = fake.find((v) => v.id === g.id)!
      const base = buildVendorInput(
        g.id,
        g.vendorName,
        g.categoryName,
        g.tableLengthFt,
        null,
        g.vendorUnitType,
        lead.tableOrientation,
        g.requestedBoothType
      )
      return { ...base, colSpan: g.colSpan, rowSpan: g.rowSpan }
    })
    return [...realVendorInputs, ...fakeForPlan]
  }

  function buildAutoPlanVendorQueue() {
    return buildAutoPlanVendorQueueFromFake(fakeVendors)
  }

  const visibleVendorInputs = useMemo(
    () => vendorInputs.filter((v) => !layoutHiddenIds.has(v.id)),
    [vendorInputs, layoutHiddenIds]
  )

  const vendorSyncKey = useMemo(
    () =>
      visibleVendorInputs
        .map(
          (v) =>
            `${v.id}:${v.colSpan}x${v.rowSpan}:${v.vendorUnitType ?? 'table'}:${v.tableLengthFt ?? ''}:${v.tableOrientation ?? ''}`
        )
        .join('|'),
    [visibleVendorInputs]
  )

  useEffect(() => {
    if (isInitializingRef.current) return
    setRooms((prev) => {
      const room = getActiveRoom(prev, activeRoomId)
      const synced = syncCellsWithVendors(visibleVendorInputs, room.cells, {
        hiddenIds: layoutHiddenIds,
        spacingMode,
        baselineTableLengthFt,
      })
      if (
        synced.length === room.cells.length &&
        synced.every((c, i) => c.id === room.cells[i]?.id && c.col === room.cells[i]?.col)
      ) {
        const metaMatch = synced.every(
          (c, i) =>
            c.colSpan === room.cells[i]?.colSpan &&
            c.rowSpan === room.cells[i]?.rowSpan &&
            c.vendorName === room.cells[i]?.vendorName
        )
        if (metaMatch) return prev
      }
      return updateRoomInList(prev, activeRoomId, { cells: synced })
    })
  }, [vendorSyncKey, activeRoomId, visibleVendorInputs, layoutHiddenIds, spacingMode, baselineTableLengthFt])

  function handleUnplaceVendor(cell: BoothCell) {
    patchActiveRoom({
      cells: cells.map((c) =>
        c.id === cell.id ? { ...c, col: -1, row: -1 } : c
      ),
    })
    toast.message(`${cell.vendorName} moved to Unplaced`, { duration: 2000 })
  }

  function handleRemoveVendorFromPlan(cell: BoothCell) {
    if (isFakeVendorId(cell.id)) {
      setFakeVendors((prev) => prev.filter((v) => v.id !== cell.id))
    } else {
      setLayoutHiddenIds((prev) => new Set(prev).add(cell.id))
    }
    patchActiveRoom({ cells: cells.filter((c) => c.id !== cell.id) })
    if (selectedVendorId === cell.id) setSelectedVendorId(null)
    toast.message(
      isFakeVendorId(cell.id)
        ? 'Test vendor removed'
        : `${cell.vendorName} removed from this layout`
    )
  }

  useEffect(() => {
    setManualFacingTarget(facingTargetFromEntrance(entrance))
  }, [entrance])

  function resolveFacingTargetForPlacement(
    srcCell: BoothCell,
    targetCol: number,
    targetRow: number
  ): FacingTarget {
    if (facingAutoMode) {
      return inferFacingTargetAtPosition(targetRow, targetCol, gridRows, gridCols)
    }
    if (srcCell.facingTarget) return srcCell.facingTarget
    return manualFacingTarget
  }

  function multiSlotCount(srcCell: BoothCell): number {
    if (isTentVendor(srcCell.vendorUnitType)) return 1
    const unit = resolveVenueTableFootprint({
      spacingMode,
      baselineTableLengthFt,
      vendorUnitType: srcCell.vendorUnitType ?? 'table',
      tableOrientation: srcCell.tableOrientation ?? resolveTableOrientation(srcCell.id, srcCell),
    })
    if (unit.colSpan <= 0) return 1
    return Math.max(1, Math.round(srcCell.colSpan / unit.colSpan))
  }

  function resolveManualPlacement(
    srcCell: BoothCell,
    targetCol: number,
    targetRow: number
  ): ReturnType<typeof resolveManualFacingPlacement> | null {
    if (!isOneFootGrid || isTentVendor(srcCell.vendorUnitType)) return null
    const facingTarget = resolveFacingTargetForPlacement(srcCell, targetCol, targetRow)
    return resolveManualFacingPlacement(
      facingTarget,
      targetRow,
      targetCol,
      baselineTableLengthFt,
      spacingMode,
      gridRows,
      gridCols
    )
  }

  function resolvePlacementSpans(
    srcCell: BoothCell,
    targetCol: number,
    targetRow: number
  ): { colSpan: number; rowSpan: number } {
    const slotCount = multiSlotCount(srcCell)
    const venueFootprint = resolveVenueTableFootprint({
      spacingMode,
      baselineTableLengthFt,
      vendorUnitType: srcCell.vendorUnitType,
      tableOrientation: srcCell.tableOrientation ?? resolveTableOrientation(srcCell.id, srcCell),
    })
    const manual = resolveManualPlacement(srcCell, targetCol, targetRow)
    if (manual) {
      if (slotCount > 1) {
        return { colSpan: manual.colSpan * slotCount, rowSpan: manual.rowSpan }
      }
      return { colSpan: manual.colSpan, rowSpan: manual.rowSpan }
    }
    const ft = baselineTableLengthFt
    if (isOneFootGrid && !isTentVendor(srcCell.vendorUnitType)) {
      const orientation =
        srcCell.tableOrientation ?? resolveTableOrientation(srcCell.id, srcCell)
      if (orientation) {
        const spans = gridSpansForTableOrientation(ft, spacingMode, orientation)
        return {
          colSpan: spans.colSpan * slotCount,
          rowSpan: spans.rowSpan,
        }
      }
      const perimeter = lockedPerimeterSpansAtOrigin(targetRow, targetCol, ft, gridRows, gridCols)
      return {
        colSpan: perimeter.colSpan * slotCount,
        rowSpan: perimeter.rowSpan,
      }
    }
    if (spacingMode === 'table_provided' && srcCell.tableOrientation) {
      const spans = gridSpansForTableOrientation(ft, spacingMode, srcCell.tableOrientation)
      return {
        colSpan: spans.colSpan * slotCount,
        rowSpan: spans.rowSpan,
      }
    }
    return {
      colSpan: venueFootprint.colSpan * slotCount,
      rowSpan: venueFootprint.rowSpan,
    }
  }

  function snapPlacementOrigin(
    targetCol: number,
    targetRow: number,
    colSpan: number,
    rowSpan: number
  ): { col: number; row: number } {
    if (!isOneFootGrid) return { col: targetCol, row: targetRow }
    return snapBoothToColumn(
      targetRow,
      targetCol,
      rowSpan,
      colSpan,
      venueElementsWithDoors.filter((el) => el.type === 'column')
    )
  }

  function canPlaceCellAt(
    srcCell: BoothCell,
    targetCol: number,
    targetRow: number
  ): boolean {
    placementBlockReason.current = null
    const { colSpan, rowSpan } = resolvePlacementSpans(srcCell, targetCol, targetRow)
    const snapped = snapPlacementOrigin(targetCol, targetRow, colSpan, rowSpan)
    targetCol = snapped.col
    targetRow = snapped.row
    const bitmap = SpatialBitGrid.fromLayout(
      gridCols,
      canvasRows,
      venueElementsWithDoors,
      cells,
      srcCell.id
    )
    if (!bitmap.canPlaceBoothRect(targetCol, targetRow, colSpan, rowSpan)) {
      placementBlockReason.current = 'Cannot place here — blocked or occupied.'
      return false
    }
    const manual = isOneFootGrid && !isTentVendor(srcCell.vendorUnitType)
      ? resolveManualPlacement(srcCell, targetCol, targetRow)
      : null
    if (manual) {
      if (
        !manualCoAisleCellsAvailableForStorefront(
          targetRow,
          targetCol,
          manual.rowSpan,
          manual.colSpan,
          manual.storefront,
          gridRows,
          gridCols,
          blocked,
          cellMap,
          srcCell.id
        )
      ) {
        placementBlockReason.current = 'Cannot place here — storefront aisle blocked.'
        return false
      }
    }

    const categoryKey = normalizeCategoryKey(srcCell.categoryName)
    const guard = buildVendorPlacementGuard({
      cols: gridCols,
      rows: canvasRows,
      placedCells: cells,
      excludeBoothId: srcCell.col >= 0 ? srcCell.id : undefined,
    })
    const excludeRect =
      srcCell.col >= 0
        ? {
            row: srcCell.row,
            col: srcCell.col,
            rowSpan: srcCell.rowSpan,
            colSpan: srcCell.colSpan,
          }
        : undefined
    if (
      guard.rejectsManualPlacement({
        categoryKey,
        row: targetRow,
        col: targetCol,
        rowSpan,
        colSpan,
        excludeRect,
      })
    ) {
      placementBlockReason.current = vendorCategoryAdjacencyMessage(srcCell.categoryName)
      return false
    }

    const pathCheck = vendorPathfindingUnobstructed({
      rows: canvasRows,
      cols: gridCols,
      venueElements: venueElementsWithDoors,
      entrance,
      placedCells: cells,
      candidate: {
        ...srcCell,
        row: targetRow,
        col: targetCol,
        colSpan,
        rowSpan,
        tableLengthFt: isTentVendor(srcCell.vendorUnitType) ? null : baselineTableLengthFt,
      },
      excludeBoothId: srcCell.col >= 0 ? srcCell.id : undefined,
      spacingMode,
      baselineTableLengthFt,
      storefront: manual?.storefront ?? null,
    })
    if (!pathCheck.ok) {
      placementBlockReason.current = vendorPathfindingBlockMessage(pathCheck.reason)
      return false
    }

    return true
  }

  function categoryPlacementBlockMessage(srcCell: BoothCell): string {
    return (
      placementBlockReason.current ??
      vendorCategoryAdjacencyMessage(srcCell.categoryName)
    )
  }

  function placeCellAt(srcCell: BoothCell, targetCol: number, targetRow: number) {
    const { colSpan, rowSpan } = resolvePlacementSpans(srcCell, targetCol, targetRow)
    const snapped = snapPlacementOrigin(targetCol, targetRow, colSpan, rowSpan)
    targetCol = snapped.col
    targetRow = snapped.row
    const manual = resolveManualPlacement(srcCell, targetCol, targetRow)
    const boothNum =
      srcCell.col >= 0 && srcCell.boothNumber > 0
        ? srcCell.boothNumber
        : nextBoothNumber(cells)

    let nextElements = venueElements
    if (srcCell.boothNumber > 0) {
      nextElements = removeCoAisleForBooth(nextElements, srcCell.boothNumber)
    }

    if (isOneFootGrid && manual) {
      const aisleRect = frontAisleRectForStorefront(
        targetRow,
        targetCol,
        manual.rowSpan,
        manual.colSpan,
        manual.storefront
      )
      if (
        aisleRect &&
        manualCoAisleCellsAvailableForStorefront(
          targetRow,
          targetCol,
          manual.rowSpan,
          manual.colSpan,
          manual.storefront,
          gridRows,
          gridCols,
          blocked,
          cellMap,
          srcCell.id
        )
      ) {
        nextElements = [...nextElements, createCoGeneratedAisleElement(aisleRect, boothNum)]
      }
    }

    patchActiveRoom({
      cells: cells.map((cell) =>
        cell.id === srcCell.id
          ? {
              ...cell,
              col: targetCol,
              row: targetRow,
              colSpan,
              rowSpan,
              boothNumber: boothNum,
              tableLengthFt: isTentVendor(srcCell.vendorUnitType) ? null : baselineTableLengthFt,
              tableOrientation: manual?.tableOrientation ??
                srcCell.tableOrientation ??
                resolveTableOrientation(srcCell.id, srcCell) ??
                null,
              facingTarget: manual?.facingTarget ?? srcCell.facingTarget ?? null,
            }
          : cell
      ),
      venue_elements: nextElements,
    })
  }

  function reorientPlacedBooth(cell: BoothCell, facingTarget: FacingTarget) {
    if (cell.col < 0 || isTentVendor(cell.vendorUnitType) || !isOneFootGrid) return
    const ft =
      cell.tableLengthFt ??
      (isOneFootGrid ? baselineTableLengthFt : DEFAULT_TABLE_LENGTH_FT)
    const manual = resolveManualFacingPlacement(
      facingTarget,
      cell.row,
      cell.col,
      ft,
      spacingMode,
      gridRows,
      gridCols
    )
    const probe = { ...cell, colSpan: manual.colSpan, rowSpan: manual.rowSpan }
    if (!canPlaceCellAt(probe, cell.col, cell.row)) {
      toast.error('Cannot rotate — blocked or out of bounds', { duration: 2500 })
      return
    }
    placeCellAt({ ...cell, facingTarget }, cell.col, cell.row)
    toast.message(`Rotated ${cell.vendorName} toward ${facingTargetLabel(facingTarget)}`, {
      duration: 2000,
    })
  }

  function handleFacingTargetChange(target: FacingTarget) {
    setFacingAutoMode(false)
    setManualFacingTarget(target)
    const placed = selectedVendorId
      ? cells.find((c) => c.id === selectedVendorId && c.col >= 0)
      : null
    if (placed) {
      reorientPlacedBooth(placed, target)
    }
  }

  function handlePerimeterFacingClick(target: FacingTarget) {
    handleFacingTargetChange(invertFacingTarget(target))
  }

  const handleSelectPlacedBooth = useCallback(
    (cell: BoothCell) => {
      setSelectedVendorId(cell.id)
      setFacingAutoMode(false)
      setManualFacingTarget(
        cell.facingTarget ??
          inferFacingTargetAtPosition(cell.row, cell.col, gridRows, gridCols)
      )
    },
    [gridRows, gridCols]
  )

  const selectedPlacedBooth = useMemo(
    () =>
      selectedVendorId
        ? cells.find((c) => c.id === selectedVendorId && c.col >= 0) ?? null
        : null,
    [selectedVendorId, cells]
  )

  function handleAddFakeVendors(
    count: number,
    options: { namePrefix: string; category: string; vendorUnitType: VendorUnitType }
  ) {
    if (options.vendorUnitType === 'tent' && !allowsTentVendors) {
      toast.error(TENT_OUTDOOR_ONLY_TOOLTIP)
      return
    }
    const rotate = options.category === 'rotate'
    const created = createFakeVendors(count, {
      namePrefix: options.namePrefix,
      category: rotate ? undefined : options.category,
      startIndex: fakeVendors.length,
      vendorUnitType: options.vendorUnitType,
      tableLengthFt: baselineTableLengthFt,
    })
    setFakeVendors((prev) => [...prev, ...created])
    toast.success(
      `Added ${count} test ${options.vendorUnitType === 'tent' ? 'tent' : 'table'} vendor${count === 1 ? '' : 's'}`
    )
  }

  function handleClearFakeVendors() {
    setFakeVendors([])
    patchActiveRoom({ cells: cells.filter((c) => !isFakeVendorId(c.id)) })
    toast.message('Test vendors removed')
  }

  function handleLayoutPresetChange(preset: LayoutPreset) {
    setLayoutPreset(preset)
    setShowPatronFlow(false)

    const genericMode = genericRowLayoutModeFromPreset(preset)

    if (preset === 'perimeter') {
      patchActiveRoom({ ...applyOutsideOnlyLayout(gridCols, gridRows, entrance), cells: [] })
      toast.success('Outside only shell applied — 4′ perimeter lane cleared for vendors')
    } else if (preset === 'aligned_grid') {
      const shell = applyAlignedGridLayout(gridCols, gridRows, entrance, venueElementsWithDoors)
      patchActiveRoom({
        ...shell,
        cells: [],
        spacing_mode: 'one_foot',
        booth_width: 1,
        booth_length: 1,
      })
      toast.success('Aligned Grid shell applied — uniform E–W rows with shared aisles')
    } else if (preset === 'l_shape_corners') {
      const shell = applyLShapeCornersLayout(gridCols, gridRows, entrance)
      patchActiveRoom({
        ...shell,
        cells: [],
        spacing_mode: 'one_foot',
        booth_width: 1,
        booth_length: 1,
      })
      toast.success('L-Shape Corners shell applied — perimeter corners cleared for vendors')
    } else if (preset === 'outdoor') {
      const corridor = hallHasIndoorShell(venueElementsWithDoors, gridCols, gridRows)
      const shell = corridor
        ? applyIndoorCorridorLayout(gridCols, gridRows, entrance, venueElementsWithDoors)
        : applyOutdoorMarketLayout(gridCols, gridRows, entrance)
      patchActiveRoom({
        ...shell,
        cells: [],
        spacing_mode: 'one_foot',
        booth_width: 1,
        booth_length: 1,
      })
      toast.success(
        corridor
          ? 'Indoor corridor rows applied — walls preserved, serpentine aisles painted'
          : 'Open-lot corridor rows applied — use table vendors or 10×10 tent vendors'
      )
    } else if (genericMode) {
      const shell = applyGenericRowLayout(
        genericMode,
        gridCols,
        gridRows,
        entrance,
        venueElementsWithDoors
      )
      patchActiveRoom({
        ...shell,
        cells: [],
        spacing_mode: 'one_foot',
        booth_width: 1,
        booth_length: 1,
      })
      const label = LAYOUT_PRESET_OPTIONS.find((p) => p.id === preset)?.label ?? preset
      toast.success(`${label} shell applied — structural fixtures preserved, booths cleared`)
    }
  }

  function applyDefaultFixtures() {
    if (layoutPreset === 'perimeter') {
      patchActiveRoom(applyOutsideOnlyLayout(gridCols, gridRows, entrance))
      toast.success('Outside only shell applied — 4′ perimeter lane cleared for vendors')
      return
    }
    patchActiveRoom({
      venue_elements: buildDefaultVenueElements(entrance, gridCols, gridRows),
    })
    toast.success('Entrance, exit, and aisles applied to outer walls')
  }

  function handleAutoFillTestVendors() {
    const fillCategories =
      eventCategoryNames.length > 0 ? eventCategoryNames : categorySummaries.map((s) => s.categoryName)

    const result = runTestLayoutFill({
      venueWidth,
      venueLength,
      boothWidth,
      boothLength,
      entrance,
      spacingMode,
      preset: layoutPreset,
      categoryNames: fillCategories,
      categoryColor: categoryColorClass,
    })

    const realCells = cells.filter((c) => !isFakeVendorId(c.id))
    setFakeVendors(result.fakeVendors)
    patchActiveRoom({
      venue_elements: result.venueElements,
      cells: [...realCells, ...result.cells],
    })

    const breakdown = result.perCategory
      .filter((p) => p.count > 0)
      .map((p) => `${p.categoryName} (${p.count})`)
      .join(', ')

    const summary = `${result.placedCount} of ${result.selectedCount} test vendors placed (${result.estimatedCapacity} fit with aisles)`
    setLastFillSummary(summary)
    toast.success(
      breakdown
        ? `Auto-filled: ${summary}. ${breakdown}`
        : summary,
      { duration: 5000 }
    )
  }

  async function handleSeedDiverseApplicationsToMax() {
    if (seedFillRunning || randomFillRunning || autoPlanRunning) return

    setSeedFillRunning(true)
    try {
      handleClearBooths()

      const { vendors, targetTableCount, slotCount } = generateDiverseSeedFakeVendors({
        maxBoothCapacity,
        layoutCapacity,
        venuePresetId: activeTemplateId,
        roomName: activeRoom.name,
      })

      if (vendors.length === 0) {
        toast.message('Venue capacity already saturated')
        return
      }

      setFakeVendors(vendors)
      setLastFillSummary(
        `${slotCount} diverse seed applications (${targetTableCount} table slots) — running auto-plan…`
      )

      await handleAutoPlan(buildAutoPlanVendorQueueFromFake(vendors))

      const powerCount = vendors.filter((v) => v.requestedBoothType === 'power').length
      const multiUnitGroups = new Set(
        vendors.filter((v) => (v.slotCount ?? 1) > 1).map((v) => v.seedGroupId)
      ).size

      setLastFillSummary(
        `Seeded ${slotCount} diverse applications (${targetTableCount} max tables, ${powerCount} power, ${multiUnitGroups} multi-unit vendors)`
      )
      toast.success(
        `Diverse seed suite: ${slotCount} application slots registered and auto-planned`,
        { duration: 5000 }
      )
    } finally {
      setSeedFillRunning(false)
    }
  }

  async function handleRandomFillTestVendorsToMax() {
    if (randomFillRunning || autoPlanRunning) return

    const registryTarget = Math.max(
      0,
      Math.max(maxBoothCapacity, layoutCapacity) - realVendorInputs.length
    )
    if (registryTarget <= 0) {
      toast.message('Venue capacity already saturated')
      return
    }

    const fillCategories =
      eventCategoryNames.length > 0
        ? eventCategoryNames
        : categorySummaries.map((s) => s.categoryName).filter(Boolean)
    const categories =
      fillCategories.length > 0 ? fillCategories : [...TEST_CATEGORY_PRESETS]

    setRandomFillRunning(true)
    try {
      handleClearBooths()

      let allCreated: FakeVendorInput[] = []
      let lastPlaced = 0
      let stagnantRounds = 0
      const batchSize = 20

      while (allCreated.length < registryTarget && stagnantRounds < 2) {
        const batch = createRandomFakeVendors({
          count: Math.min(batchSize, registryTarget - allCreated.length),
          categoryNames: categories,
          allowsTentVendors: false,
          tentShare: 0,
        })
        if (batch.length === 0) break
        allCreated = [...allCreated, ...batch]
        setFakeVendors(allCreated)
        setLastFillSummary(
          `${allCreated.length} random vendors registered — Smart Populate running…`
        )

        const planInputs = buildAutoPlanVendorQueueFromFake(allCreated)

        const planStrategy = resolveAutoPlanStrategy({
          layoutPreset,
          gridCols,
          gridRows,
          entrance,
          venueElementsWithDoors,
          isOneFootGrid,
        })
        if (planStrategy.presetShell) {
          patchActiveRoom(planStrategy.presetShell)
        }

        const layoutResult = await autoLayoutAsync({
          venueWidth: templateAnchor.width,
          venueLength: templateAnchor.length,
          boothWidth,
          boothLength,
          entrance,
          venueElements: planStrategy.venueElementsForPlan,
          vendors: sortVendorsFcfs(planInputs, appliedAtById),
          preset: planStrategy.effectivePreset,
          useIndoorCorridor: planStrategy.useCorridor,
          fcfsOrder: true,
          coGenerateAisles: planStrategy.coGenerateAisles,
        })

        patchActiveRoom({
          cells: layoutResult.cells,
          ...(planStrategy.presetShell || planStrategy.coGenerateAisles
            ? { venue_elements: layoutResult.venueElements }
            : {}),
        })

        const placed = layoutResult.placedCount
        if (placed <= lastPlaced) stagnantRounds++
        else stagnantRounds = 0
        lastPlaced = placed

        if (layoutCapacity > 0 && placed >= layoutCapacity) break
      }

      const tentCount = allCreated.filter((v) => v.vendorUnitType === 'tent').length
      const tableCount = allCreated.length - tentCount
      const categoryTally = new Map<string, number>()
      for (const v of allCreated) {
        categoryTally.set(v.categoryName, (categoryTally.get(v.categoryName) ?? 0) + 1)
      }
      const breakdown = [...categoryTally.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, n]) => `${name} (${n})`)
        .join(', ')

      setLastFillSummary(
        `${allCreated.length} random test vendors (${lastPlaced} placed, ${tableCount} tables, ${tentCount} tents). ${breakdown}`
      )
      toast.success(
        `Random fill saturated: ${lastPlaced} placed of ${allCreated.length} registered (${tableCount} tables, ${tentCount} tents)`,
        { duration: 5000 }
      )
    } finally {
      setRandomFillRunning(false)
    }
  }

  function setSpacingModeAndGrid(mode: LayoutSpacingMode) {
    if (mode === 'one_foot') {
      patchActiveRoom({
        spacing_mode: mode,
        booth_width: 1,
        booth_length: 1,
      })
    } else if (mode === 'table_provided') {
      patchActiveRoom({
        spacing_mode: mode,
        booth_width: TABLE_GRID_CELL_WIDTH_FT,
        booth_length: TABLE_GRID_CELL_LENGTH_FT,
      })
    } else {
      patchActiveRoom({
        spacing_mode: 'one_foot',
        booth_width: 1,
        booth_length: 1,
      })
    }
  }

  function handleBaselineTableSizeChange(nextFt: LayoutBaselineTableLengthFt) {
    if (nextFt === baselineTableLengthFt) return

    const result = validateBaselineTableSizeChange({
      tableLengthFt: nextFt,
      cells,
      rows: gridRows,
      cols: gridCols,
      blocked,
      venueElements: venueElementsWithDoors,
      spacingMode,
      cellWidthFt: gridConfig.cellWidthFt,
      cellLengthFt: gridConfig.cellLengthFt,
    })

    if (!result.ok) {
      setLayoutAlert(result.message)
      setDismissedAlerts((prev) => {
        const next = new Set(prev)
        next.delete('layout-exception')
        return next
      })
      return
    }

    setLayoutAlert(null)

    const nextLengths: Record<string, number> = {}
    for (const app of approvedApps) {
      nextLengths[app.id] = nextFt
    }
    setVendorTableLengths(nextLengths)
    setFakeVendors((prev) =>
      prev.map((v) => (v.vendorUnitType === 'tent' ? v : { ...v, tableLengthFt: nextFt }))
    )

    patchActiveRoom({
      baseline_table_length_ft: nextFt,
      cells: result.cells,
    })
  }

  function handleTableLengthChange(applicationId: string, tableLengthFt: number) {
    if (usesTableUnits) {
      if (isLayoutBaselineTableLengthFt(tableLengthFt)) {
        handleBaselineTableSizeChange(tableLengthFt)
      }
      return
    }

    if (spacingMode === 'standard') {
      setVendorTableLengths((prev) => ({ ...prev, [applicationId]: tableLengthFt }))
      return
    }

    const orientation = resolveTableOrientation(
      applicationId,
      cells.find((c) => c.id === applicationId)
    )

    const candidateCells = cells.map((cell) =>
      cell.id === applicationId
        ? (() => {
            const { colSpan, rowSpan } = gridSpansForTableLength(
              tableLengthFt,
              spacingMode,
              orientation ?? cell.tableOrientation
            )
            return { ...cell, colSpan, rowSpan, tableLengthFt }
          })()
        : cell
    )

    const placed = candidateCells.some((c) => c.id === applicationId && c.col >= 0)
    if (placed) {
      const check = validateTableSizeLayout({
        tableLengthFt,
        cells: candidateCells,
        rows: gridRows,
        cols: gridCols,
        blocked,
        venueElements: venueElementsWithDoors,
        cellWidthFt: gridConfig.cellWidthFt,
        cellLengthFt: gridConfig.cellLengthFt,
      })
      if (!check.ok) {
        toast.warning(check.message, { duration: 8000 })
        return
      }
      patchActiveRoom({ cells: check.cells })
    } else {
      patchActiveRoom({ cells: candidateCells })
    }

    setVendorTableLengths((prev) => ({ ...prev, [applicationId]: tableLengthFt }))
    setFakeVendors((prev) =>
      prev.map((v) => (v.id === applicationId ? { ...v, tableLengthFt } : v))
    )
  }

  function handleTableOrientationChange(applicationId: string, orientation: TableOrientation) {
    if (spacingMode === 'standard') return

    const cell = cells.find((c) => c.id === applicationId)
    const tableLengthFt = baselineTableLengthFt

    const { colSpan, rowSpan } = gridSpansForTableOrientation(
      tableLengthFt,
      spacingMode,
      orientation
    )

    const candidateCells = cells.map((c) =>
      c.id === applicationId ? { ...c, colSpan, rowSpan, tableOrientation: orientation } : c
    )

    const placed = cell != null && cell.col >= 0
    if (placed) {
      const check = validateTableSizeLayout({
        tableLengthFt,
        cells: candidateCells,
        rows: gridRows,
        cols: gridCols,
        blocked,
        venueElements: venueElementsWithDoors,
        cellWidthFt: gridConfig.cellWidthFt,
        cellLengthFt: gridConfig.cellLengthFt,
      })
      if (!check.ok) {
        toast.warning(check.message, { duration: 8000 })
        return
      }
      patchActiveRoom({ cells: check.cells })
    } else {
      patchActiveRoom({ cells: candidateCells })
    }

    setVendorTableOrientations((prev) => ({ ...prev, [applicationId]: orientation }))
    setFakeVendors((prev) =>
      prev.map((v) => (v.id === applicationId ? { ...v, tableOrientation: orientation } : v))
    )
  }

  function handleRotateTable(cell: BoothCell) {
    if (isTentVendor(cell.vendorUnitType)) return
    const current =
      cell.tableOrientation ??
      resolveTableOrientation(cell.id, cell) ??
      inferTableOrientation(cell.colSpan, cell.rowSpan, cell.tableLengthFt ?? undefined)
    handleTableOrientationChange(cell.id, toggleTableOrientation(current))
  }

  const appliedAtById = useMemo(
    () => Object.fromEntries(applications.map((a) => [a.id, a.applied_at ?? ''])),
    [applications]
  )

  async function handleAutoPlan(vendorOverride?: VendorPlanInput[]) {
    if (autoPlanRunning) return

    const presetLabel =
      LAYOUT_PRESET_OPTIONS.find((p) => p.id === layoutPreset)?.label ?? 'Standard'
    const planVendors = vendorOverride ?? buildAutoPlanVendorQueue()
    const fcfsSorted = sortVendorsFcfs(planVendors, appliedAtById)

    autoPlanAbortRef.current = false
    setAutoPlanRunning(true)
    setCapacityAlertVisible(false)
    setCapacityAlertMessage(null)

    try {
      const planStrategy = resolveAutoPlanStrategy({
        layoutPreset,
        gridCols,
        gridRows,
        entrance,
        venueElementsWithDoors,
        isOneFootGrid,
      })

      if (planStrategy.presetShell) {
        patchActiveRoom(planStrategy.presetShell)
      }

      const layoutResult = await autoLayoutAsync(
        {
          venueWidth: templateAnchor.width,
          venueLength: templateAnchor.length,
          boothWidth,
          boothLength,
          entrance,
          venueElements: planStrategy.venueElementsForPlan,
          vendors: fcfsSorted,
          preset: planStrategy.effectivePreset,
          useIndoorCorridor: planStrategy.useCorridor,
          fcfsOrder: true,
          coGenerateAisles: planStrategy.coGenerateAisles,
        },
        {
          vendorsPerFrame: 3,
          isCancelled: () => autoPlanAbortRef.current,
          onProgress: (partial) => {
            suppressHistoryRef.current = true
            patchActiveRoom({
              cells: partial.cells,
              ...(planStrategy.coGenerateAisles && partial.venueElements.length > 0
                ? { venue_elements: partial.venueElements }
                : planStrategy.presetShell && partial.venueElements.length > 0
                  ? { venue_elements: partial.venueElements }
                  : {}),
            })
            suppressHistoryRef.current = false
            if (partial.stoppedOnOverlap) {
              setDismissedAlerts((prev) => {
                const next = new Set(prev)
                next.delete('overlap-booth')
                return next
              })
            }
          },
        }
      )

      patchActiveRoom({
        cells: layoutResult.cells,
        ...(planStrategy.coGenerateAisles && layoutResult.venueElements.length > 0
          ? { venue_elements: layoutResult.venueElements }
          : planStrategy.presetShell
            ? { venue_elements: layoutResult.venueElements }
            : {}),
      })

      const placed = layoutResult.placedCount
      const overflow = layoutResult.unplacedCount
      const clearance = analyzeStrollerClearance({
        rows: gridRows,
        cols: gridCols,
        boothWidthFt: gridConfig.cellWidthFt,
        boothLengthFt: gridConfig.cellLengthFt,
        cells: layoutResult.cells,
        venueElements:
          planStrategy.coGenerateAisles ||
          planStrategy.useCorridor ||
          planStrategy.genericMode
            ? layoutResult.venueElements
            : planStrategy.venueElementsForPlan,
      })

      if (layoutResult.stoppedOnOverlap) {
        setDismissedAlerts((prev) => {
          const next = new Set(prev)
          next.delete('overlap-booth')
          return next
        })
        toast.error(OVERLAP_RULE_FAILURE_MESSAGE, { duration: 8000 })
      } else if (layoutResult.iterationLimitHit) {
        setCapacityAlertMessage(AUTO_PLAN_CAPACITY_LIMIT_MESSAGE)
        setCapacityAlertVisible(true)
      } else if (layoutResult.capacityReached && layoutResult.capacityMessage) {
        setCapacityAlertMessage(layoutResult.capacityMessage)
        setCapacityAlertVisible(true)
        toast.warning(layoutResult.capacityMessage, { duration: 6000 })
      } else if (overflow > 0 && (layoutPreset === 'perimeter' || layoutPreset === 'outdoor')) {
        toast.warning(
          `${overflow} vendor${overflow === 1 ? '' : 's'} could not fit in the ${layoutPreset === 'outdoor' ? 'outdoor row' : 'perimeter'} zones — try a larger venue or Standard preset`
        )
      } else if (clearance.hasBottleneck) {
        setShowPatronFlow(false)
        toast.warning(`Layout planned (${presetLabel}) with stroller aisle warnings — widen walkways to 8ft`)
      } else {
        const corridorLabel = planStrategy.useCorridor ? 'Corridor rows (indoor)' : presetLabel
        const fullCapacity =
          overflow === 0 && planVendors.length > 0 && placed === planVendors.length
        if (fullCapacity && !clearance.hasBottleneck) {
          setShowPatronFlow(true)
        }
        toast.success(
          fullCapacity && planStrategy.useCorridor
            ? `Layout optimized (${corridorLabel}) — ${placed}/${planVendors.length} placed, patron flow ready`
            : `Booths auto-planned (${corridorLabel}) — ${placed} placed`
        )
      }
    } finally {
      setAutoPlanRunning(false)
    }
  }

  function handleClearCanvasConfirm() {
    const patch = resetRoomToPresetBlueprint(activeTemplateId, gridCols, gridRows)
    setFakeVendors([])
    setLayoutHiddenIds(new Set())
    setLastFillSummary(null)
    setShowPatronFlow(false)
    setSelectedVendorId(null)
    patchActiveRoom(patch)
    setClearCanvasOpen(false)
    const preset = activeTemplateId !== 'blank' ? getVenuePresetById(activeTemplateId) : null
    if (preset) {
      toast.success(`${preset.label} blueprint restored — vendors and painted items removed`)
    } else {
      toast.success('Canvas cleared')
    }
  }

  function handleLoadVenuePreset(presetId: VenuePresetId) {
    setVenuePresetId(presetId)
    lastHydratedTemplateKeyRef.current = null

    if (presetId === 'blank') {
      isInitializingRef.current = true
      suppressHistoryRef.current = true
      setRooms((prev) =>
        updateRoomInList(prev, activeRoomId, {
          cells: [],
          venue_elements: [],
          venue_preset_id: null,
        })
      )
      lastHydratedTemplateKeyRef.current = `${activeRoomId}:blank`
      window.setTimeout(() => {
        isInitializingRef.current = false
        suppressHistoryRef.current = false
      }, 0)
      toast.success('Canvas cleared')
      return
    }

    const preset = getVenuePresetById(presetId)
    if (!preset) return

    /** Purge snapshots; structural paint runs synchronously here and via the template effect guard. */
    isInitializingRef.current = true
    suppressHistoryRef.current = true
    setFakeVendors([])
    setRooms((prev) =>
      updateRoomInList(prev, activeRoomId, {
        cells: [],
        venue_elements: [],
        venue_preset_id: null,
        ...hydrateVenuePreset(presetId),
      })
    )
    lastHydratedTemplateKeyRef.current = `${activeRoomId}:${presetId}`
    window.setTimeout(() => {
      isInitializingRef.current = false
      suppressHistoryRef.current = false
    }, 0)
    toast.success(
      `${preset.label} loaded — ${preset.canvasWidth}′ × ${preset.canvasHeight}′ (${preset.canvasWidth * preset.canvasHeight} sq ft)`
    )
  }

  function handleClearBooths() {
    const keptElements = clearUserPlacedLayout(venueElements, gridCols, gridRows)
    setShowPatronFlow(false)
    patchActiveRoom({ cells: [], venue_elements: keptElements })
    toast.message('Booths cleared — co-generated aisles removed, template shell kept')
  }

  function handleToggleFixtureLock(elementId: string) {
    const next = toggleElementLockById(venueElements, elementId)
    const el = next.find((e) => e.id === elementId)
    if (el) {
      toast.message(el.locked ? 'Fixture locked' : 'Fixture unlocked', { duration: 1500 })
    }
    patchActiveRoom({ venue_elements: next })
  }

  const applyPaint = useCallback(
    (row: number, col: number) => {
      if (row < 0 || col < 0 || row >= canvasRows || col >= gridCols) return

      if (activeTool === 'vendor' || activeTool === 'lock') return

      if (activeTool === 'custom_label') {
        const label = paintLabelRef.current ?? customLabelDraft.trim()
        if (!label) {
          const input = window.prompt('Label for this area:', customLabelDraft || 'Area')
          if (!input?.trim()) return
          paintLabelRef.current = input.trim()
          setCustomLabelDraft(input.trim())
          patchActiveRoomFn((room) => ({
            venue_elements: paintCells(
              room.venue_elements,
              [{ row, col }],
              'custom_label',
              input.trim(),
              { cols: gridCols, rows: gridRows }
            ),
          }))
          return
        }
        patchActiveRoomFn((room) => ({
          venue_elements: paintCells(
            room.venue_elements,
            [{ row, col }],
            'custom_label',
            label,
            { cols: gridCols, rows: gridRows }
          ),
        }))
        return
      }

      if (activeTool === 'entrance' || activeTool === 'exit') {
        if (wallAtCell(row, col, gridCols, gridRows)) {
          patchActiveRoomFn((room) => ({
            venue_elements: moveDoorOnWall(
              room.venue_elements,
              activeTool,
              entrance,
              row,
              col,
              gridCols,
              gridRows
            ),
          }))
        }
        return
      }

      if (activeTool === 'eraser') {
        const booth = cellMap.get(`${row}-${col}`)
        if (booth) {
          handleUnplaceVendor(booth)
          return
        }
        patchActiveRoomFn((room) => ({
          venue_elements: removeElementsAt(room.venue_elements, row, col, {
            cols: gridCols,
            rows: gridRows,
          }),
        }))
        return
      }

      patchActiveRoomFn((room) => ({
        venue_elements: paintCells(room.venue_elements, [{ row, col }], activeTool, undefined, {
          cols: gridCols,
          rows: gridRows,
        }),
      }))
    },
    [activeTool, customLabelDraft, gridCols, gridRows, canvasRows, patchActiveRoomFn, cellMap, handleUnplaceVendor, entrance]
  )

  const onCellPointerDown = useCallback(
    (row: number, col: number) => {
      if (activeTool === 'vendor') return
      if (!isPainting.current) recordHistory()
      if (activeTool === 'lock') {
        const booth = cellMap.get(`${row}-${col}`)
        if (booth) {
          handleSelectPlacedBooth(booth)
          return
        }
        patchActiveRoomFn((room) => ({
          venue_elements: toggleElementLock(room.venue_elements, row, col),
        }))
        return
      }
      isPainting.current = true
      applyPaint(row, col)
    },
    [activeTool, applyPaint, patchActiveRoomFn, recordHistory, cellMap, handleSelectPlacedBooth]
  )

  const onCellPointerEnter = useCallback(
    (row: number, col: number) => {
      if (activeTool === 'vendor' || activeTool === 'lock') return
      if (!isPainting.current) return
      applyPaint(row, col)
    },
    [activeTool, applyPaint]
  )

  const handleDragStart = useCallback(
    (e: React.DragEvent, col: number, row: number) => {
      if (activeTool !== 'vendor') {
        e.preventDefault()
        return
      }
      dragSource.current = { kind: 'grid', col, row }
      e.dataTransfer.effectAllowed = 'move'
    },
    [activeTool]
  )

  const handleUnplacedDragStart = useCallback(
    (e: React.DragEvent, cell: BoothCell) => {
      if (activeTool !== 'vendor') {
        e.preventDefault()
        return
      }
      dragSource.current = { kind: 'unplaced', cellId: cell.id }
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', cell.id)
    },
    [activeTool]
  )

  const handleDoorDragStart = useCallback(
    (e: React.DragEvent, doorType: 'entrance' | 'exit') => {
      dragSource.current = { kind: 'door', doorType }
      e.dataTransfer.effectAllowed = 'move'
    },
    []
  )

  const handleDoorDrop = useCallback(
    (targetCol: number, targetRow: number) => {
      const src = dragSource.current
      if (!src || src.kind !== 'door') return

      patchActiveRoomFn((room) => {
        const before = room.venue_elements.find((e) => e.type === src.doorType)
        const next = moveDoorOnWall(
          room.venue_elements,
          src.doorType,
          entrance,
          targetRow,
          targetCol,
          gridCols,
          gridRows
        )
        const after = next.find((e) => e.type === src.doorType)
        if (
          !after ||
          (before?.row === after.row && before?.col === after.col)
        ) {
          toast.message('Move doors along their outer wall only', { duration: 2000 })
        }
        return { venue_elements: next }
      })
      dragSource.current = null
    },
    [entrance, gridCols, gridRows, patchActiveRoomFn]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent, targetCol: number, targetRow: number) => {
      e.preventDefault()
      const src = dragSource.current
      if (!src) return

      if (src.kind === 'door') {
        handleDoorDrop(targetCol, targetRow)
        return
      }

      if (activeTool !== 'vendor') return

      let srcCell: BoothCell | undefined
      if (src.kind === 'unplaced') {
        srcCell = cells.find((c) => c.id === src.cellId)
      } else {
        srcCell = cellMap.get(`${src.row}-${src.col}`)
      }
      if (!srcCell) return

      if (!canPlaceCellAt(srcCell, targetCol, targetRow)) return

      placeCellAt(srcCell, targetCol, targetRow)
      dragSource.current = null
      setDragHoverCell(null)
      setSelectedVendorId(null)
    },
    [activeTool, cellMap, cells, canPlaceCellAt, placeCellAt, handleDoorDrop]
  )

  const handlePlaceOnCellClick = useCallback(
    (targetCol: number, targetRow: number) => {
      if (activeTool !== 'vendor') return
      const existing = cellMap.get(`${targetRow}-${targetCol}`)
      if (existing) {
        handleUnplaceVendor(existing)
        setSelectedVendorId(null)
        toast.message(`${existing.vendorName} removed from canvas`, { duration: 1500 })
        return
      }
      const toPlace = selectedVendorId
        ? cells.find((c) => c.id === selectedVendorId && c.col < 0)
        : overflow[0]
      if (!toPlace) return
      if (!canPlaceCellAt(toPlace, targetCol, targetRow)) {
        toast.message(categoryPlacementBlockMessage(toPlace), { duration: 2500 })
        return
      }
      placeCellAt(toPlace, targetCol, targetRow)
      setSelectedVendorId(null)
      toast.success(`${toPlace.vendorName} placed`, { duration: 1500 })
    },
    [activeTool, cellMap, selectedVendorId, cells, overflow, canPlaceCellAt, placeCellAt, handleUnplaceVendor]
  )

  const [dragHoverCell, setDragHoverCell] = useState<{ row: number; col: number } | null>(null)

  const clearanceOverlay = useMemo((): DualRingOverlayResult | null => {
    if (activeTool !== 'vendor' || !isOneFootGrid || !dragHoverCell) return null

    const src = dragSource.current
    let srcCell: BoothCell | undefined
    if (src?.kind === 'unplaced') {
      srcCell = cells.find((c) => c.id === src.cellId)
    } else if (src?.kind === 'grid') {
      srcCell = cellMap.get(`${src.row}-${src.col}`)
    } else {
      srcCell =
        selectedVendorId != null
          ? cells.find((c) => c.id === selectedVendorId && c.col < 0)
          : overflow[0]
    }
    if (!srcCell || isTentVendor(srcCell.vendorUnitType)) return null

    const { rowSpan, colSpan } = resolvePlacementSpans(
      srcCell,
      dragHoverCell.col,
      dragHoverCell.row
    )
    const placed = cells
      .filter((c) => c.col >= 0 && c.id !== srcCell.id)
      .map((c) => ({
        id: c.id,
        row: c.row,
        col: c.col,
        rowSpan: c.rowSpan,
        colSpan: c.colSpan,
      }))

    return computeDualRingOverlay({
      active: {
        id: srcCell.id,
        row: dragHoverCell.row,
        col: dragHoverCell.col,
        rowSpan,
        colSpan,
      },
      placed,
      rows: canvasRows,
      cols: gridCols,
      allowMultiUnitSnap: multiSlotCount(srcCell) > 1,
    })
  }, [
    activeTool,
    isOneFootGrid,
    dragHoverCell,
    cells,
    cellMap,
    selectedVendorId,
    overflow,
    canvasRows,
    gridCols,
    baselineTableLengthFt,
  ])

  const getCompositeFootprintAt = useCallback(
    (row: number, col: number) => {
      if (activeTool !== 'vendor' || !isOneFootGrid) return null
      const toPlace = selectedVendorId
        ? cells.find((c) => c.id === selectedVendorId && c.col < 0)
        : overflow[0]
      if (!toPlace || isTentVendor(toPlace.vendorUnitType)) return null
      const { colSpan, rowSpan } = resolvePlacementSpans(toPlace, col, row)
      const placingId = toPlace.col >= 0 ? toPlace.id : undefined
      const occupied = new Set(occupiedBoothKeys)
      if (placingId) {
        for (let dr = 0; dr < toPlace.rowSpan; dr++) {
          for (let dc = 0; dc < toPlace.colSpan; dc++) {
            occupied.delete(`${toPlace.row + dr}-${toPlace.col + dc}`)
          }
        }
      }
      return evaluateCompositePlacement({
        boothRow: row,
        boothCol: col,
        rowSpan,
        colSpan,
        rows: canvasRows,
        cols: gridCols,
        obstructed,
        occupied,
      })
    },
    [
      activeTool,
      isOneFootGrid,
      selectedVendorId,
      cells,
      overflow,
      canvasRows,
      gridCols,
      gridRows,
      entrance,
      obstructed,
      occupiedBoothKeys,
      facingAutoMode,
      manualFacingTarget,
      baselineTableLengthFt,
      spacingMode,
    ]
  )

  async function handleSmartPopulateEventCaps(limits: CategoryLimit[]) {
    if (layoutOverlaps.hasOverlap) {
      toast.error(OVERLAP_RULE_FAILURE_MESSAGE, { duration: 8000 })
      setDismissedAlerts((prev) => {
        const next = new Set(prev)
        next.delete('overlap-booth')
        return next
      })
      return
    }
    if (limits.length === 0) return
    try {
      await supabase.from('event_category_limits').delete().eq('event_id', eventId)
      const { error } = await supabase.from('event_category_limits').insert(
        limits.map((cl) => ({
          event_id: eventId,
          category_id: cl.categoryId,
          max_slots: cl.maxSlots,
          price_per_booth: cl.pricePerBooth,
          table_length_ft: cl.tableLengthFt ?? null,
        }))
      )
      if (error) throw error
      toast.success('Event booth caps updated from room dimensions')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save booth caps to event')
    }
  }

  async function handleSave(): Promise<boolean> {
    if (layoutOverlaps.hasOverlap) {
      toast.error(OVERLAP_RULE_FAILURE_MESSAGE, { duration: 8000 })
      setDismissedAlerts((prev) => {
        const next = new Set(prev)
        next.delete('overlap-booth')
        return next
      })
      return false
    }

    setSaving(true)
    try {
      const payload = layoutPayloadFromRooms(eventId, rooms, activeRoomId)

      const { error } = await supabase.from('booth_layouts').upsert(payload, { onConflict: 'event_id' })
      if (error) throw error

      const placed = cells.filter((c) => c.col >= 0)
      for (const cell of placed) {
        if (isFakeVendorId(cell.id)) continue
        const updates: { booth_number: number; table_length_ft?: number } = {
          booth_number: cell.boothNumber,
        }
        if (usesTableUnits && cell.tableLengthFt != null) {
          updates.table_length_ft = cell.tableLengthFt
        }
        await supabase.from('booth_applications').update(updates).eq('id', cell.id)
      }

      if (usesTableUnits) {
        for (const app of approvedApps) {
          const ft = vendorTableLengths[app.id]
          if (ft != null && !placed.some((c) => c.id === app.id)) {
            await supabase
              .from('booth_applications')
              .update({ table_length_ft: ft })
              .eq('id', app.id)
          }
        }
      }

      toast.success('Layout saved!')
      return true
    } catch (err) {
      console.error(err)
      toast.error('Failed to save layout')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBlankLayout(): Promise<boolean> {
    if (layoutOverlaps.hasOverlap) {
      toast.error(OVERLAP_RULE_FAILURE_MESSAGE, { duration: 8000 })
      return false
    }

    setSaving(true)
    try {
      const unplacedOnly = cells.filter((c) => c.col < 0)
      const nextRooms = updateRoomInList(rooms, activeRoomId, { cells: unplacedOnly })
      setRooms(nextRooms)
      const payload = layoutPayloadFromRooms(eventId, nextRooms, activeRoomId)

      const { error } = await supabase.from('booth_layouts').upsert(payload, { onConflict: 'event_id' })
      if (error) throw error

      toast.success('Blank floor plan saved (venue shell only)')
      return true
    } catch (err) {
      console.error(err)
      toast.error('Failed to save blank floor plan')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleAutoPlanAndSave(): Promise<boolean> {
    await handleAutoPlan()
    return handleSave()
  }

  useEffect(() => {
    if (saveLayoutRef) {
      saveLayoutRef.current = handleSave
    }
    if (autoPlanRef) {
      autoPlanRef.current = handleAutoPlanAndSave
    }
    if (saveBlankLayoutRef) {
      saveBlankLayoutRef.current = handleSaveBlankLayout
    }
  })

  useEffect(() => {
    onOverlapChange?.(layoutOverlaps.hasOverlap)
  }, [layoutOverlaps.hasOverlap, onOverlapChange])

  function goToWizardStep(step: LayoutPlannerStep) {
    setCurrentStep(step)
    setMaxReachableStep((prev) => (step > prev ? step : prev))
  }

  function validateStep1(): boolean {
    if (templateAnchor.width < 10 || templateAnchor.length < 10) {
      toast.error('Choose a hall template or set venue dimensions (min 10 ft).')
      return false
    }
    return true
  }

  function handleWizardNext() {
    if (currentStep === 1) {
      if (!validateStep1()) return
      goToWizardStep(2)
      return
    }
    if (currentStep === 2) {
      goToWizardStep(3)
      return
    }
    if (currentStep === 3) {
      goToWizardStep(4)
    }
  }

  function handleWizardBack() {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as LayoutPlannerStep)
    }
  }

  const renderGridParams = useMemo(() => {
    if (!canvasMounted) return null
    return {
      rows: canvasRows,
      cols: gridCols,
      hallRows: gridRows,
      cellMap,
      venueMap,
      blocked,
      bottleneckKeys: strollerClearance.bottleneckKeys,
      overlapKeys: layoutOverlaps.overlapKeys,
      showBottleneckOverlay: showStrollerOverlays,
      activeTool,
      entrance,
      isOneFootGrid,
      onCellPointerDown,
      onCellPointerEnter,
      onToggleFixtureLock: handleToggleFixtureLock,
      handleDragStart,
      handleDrop,
      onDoorDragStart: handleDoorDragStart,
      onVendorPlaceClick: handlePlaceOnCellClick,
      onUnplaceVendor: handleUnplaceVendor,
      onSelectPlacedBooth: handleSelectPlacedBooth,
      selectedVendorId,
      onRotateTable: handleRotateTable,
      cellWidthFt: gridConfig.cellWidthFt,
      cellLengthFt: gridConfig.cellLengthFt,
      getCompositeFootprintAt,
      clearanceOverlay,
      onDragHover: (row: number, col: number) => setDragHoverCell({ row, col }),
      onDragHoverEnd: () => setDragHoverCell(null),
      onVendorHover: (row: number, col: number) => {
        if (!facingAutoMode) return
        setHoverSuggestedFacing(inferFacingTargetAtPosition(row, col, gridRows, gridCols))
      },
    }
  },
    [
      gridRows,
      canvasRows,
      gridCols,
      cellMap,
      venueMap,
      blocked,
      strollerClearance.bottleneckKeys,
      layoutOverlaps.overlapKeys,
      showStrollerOverlays,
      activeTool,
      entrance,
      isOneFootGrid,
      gridConfig.cellWidthFt,
      gridConfig.cellLengthFt,
      onCellPointerDown,
      onCellPointerEnter,
      handleToggleFixtureLock,
      handleDragStart,
      handleDrop,
      handleDoorDragStart,
      handlePlaceOnCellClick,
      handleUnplaceVendor,
      handleSelectPlacedBooth,
      selectedVendorId,
      handleRotateTable,
      getCompositeFootprintAt,
      clearanceOverlay,
      facingAutoMode,
      canvasMounted,
      dragHoverCell,
    ]
  )

  const renderGridSlice = useCallback(
    (slice?: QuadrantBounds) => {
      if (!renderGridParams) return []
      return renderGrid({ ...renderGridParams, slice })
    },
    [renderGridParams]
  )

  return (
    <div
      className="space-y-6"
      onMouseUp={canvasMounted ? () => { isPainting.current = false } : undefined}
      onMouseLeave={canvasMounted ? () => { isPainting.current = false } : undefined}
    >
      {!canvasOnly ? (
        <LayoutPlannerStepper
          currentStep={currentStep}
          maxReachableStep={maxReachableStep}
          onStepChange={goToWizardStep}
        />
      ) : null}

      {!hideRoomBar && currentStep !== 3 && !canvasOnly ? (
        <LayoutRoomBar
          rooms={rooms}
          activeRoomId={activeRoomId}
          onSelectRoom={handleSelectRoom}
          onAddRoom={handleAddRoom}
          onRenameRoom={handleRenameRoom}
          onDeleteRoom={handleDeleteRoom}
        />
      ) : null}

      {!canvasOnly && currentStep === 1 && (
        <div className="space-y-4">
          <div className="market-panel p-4 space-y-4">
            <h2 className={WIZARD_STEP_TITLE}>
              Step 1 — Venue Selection &amp; Core Dimensions
            </h2>
            <EdmontonVenueTemplateBar
              value={venuePresetId}
              onChange={handleLoadVenuePreset}
            />
            {templateAnchor.isAnchored && templateAnchor.preset ? (
              <p className="text-xs font-medium text-forest bg-sage-50 border border-sage-200 rounded-lg px-3 py-2">
                Template locked: {templateAnchor.preset.label} — {templateAnchor.width}′ ×{' '}
                {templateAnchor.length}′ ({(templateAnchor.width * templateAnchor.length).toLocaleString()} sq ft)
              </p>
            ) : null}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Venue Width (ft)
                </label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  value={templateAnchor.isAnchored ? templateAnchor.width : venueWidth}
                  readOnly={templateAnchor.isAnchored}
                  onChange={(e) => patchActiveRoom({ venue_width: Number(e.target.value) })}
                  className={`w-24 rounded-lg border-2 border-stone-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30 ${
                    templateAnchor.isAnchored ? 'bg-muted/50 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-[10px] text-muted-foreground">
                  → {gridCols} col{gridCols === 1 ? '' : 's'} × {gridConfig.cellWidthFt}′
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Venue Length (ft)
                </label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  step={10}
                  value={templateAnchor.isAnchored ? templateAnchor.length : venueLength}
                  readOnly={templateAnchor.isAnchored}
                  onChange={(e) => patchActiveRoom({ venue_length: Number(e.target.value) })}
                  className={`w-24 rounded-lg border-2 border-stone-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-forest/30 ${
                    templateAnchor.isAnchored ? 'bg-muted/50 cursor-not-allowed' : ''
                  }`}
                />
                <p className="text-[10px] text-muted-foreground">
                  → {gridRows} row{gridRows === 1 ? '' : 's'} × {gridConfig.cellLengthFt}′
                </p>
              </div>
            </div>
            <GridScaleBanner
              venueWidthFt={templateAnchor.width}
              venueLengthFt={templateAnchor.length}
              boothWidthFt={boothWidth}
              boothLengthFt={boothLength}
              spacingMode={spacingMode}
            />
          </div>
          <LayoutPlannerWizardNav currentStep={1} onNext={handleWizardNext} showBack={false} />
        </div>
      )}

      {!canvasOnly && currentStep === 2 && (
        <div className="space-y-4">
          <div className="market-panel p-4 space-y-4">
            <h2 className={WIZARD_STEP_TITLE}>
              Step 2 — Table Specifications &amp; Rules
            </h2>
            {allCategories.length > 0 && (
              <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
                <div className="flex-1 min-w-0">
                  <SmartPopulateBoothCaps
                    categories={allCategories}
                    allowMlm={allowMlm}
                    venueWidthFt={templateAnchor.width}
                    venueLengthFt={templateAnchor.length}
                    onVenueWidthChange={(ft) => {
                      if (templateAnchor.isAnchored) return
                      patchActiveRoom({ venue_width: ft })
                    }}
                    onVenueLengthChange={(ft) => {
                      if (templateAnchor.isAnchored) return
                      patchActiveRoom({ venue_length: ft })
                    }}
                    onPopulate={handleSmartPopulateEventCaps}
                    venueReadOnly={templateAnchor.isAnchored}
                    venueElements={venueElementsWithDoors}
                    entrance={entrance}
                    compact
                    tableLengthFt={baselineTableLengthFt}
                    onTableLengthChange={handleBaselineTableSizeChange}
                    hideTableSizeSelector
                    actionsBlocked={layoutOverlaps.hasOverlap}
                    blockReason={OVERLAP_RULE_FAILURE_MESSAGE}
                  />
                </div>
                {usesTableUnits && (
                  <TableSizeSelector
                    value={baselineTableLengthFt}
                    onChange={handleBaselineTableSizeChange}
                  />
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 min-w-[200px]">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Booth spacing
                </label>
                <div className="flex rounded-lg border-2 border-stone-200 overflow-hidden bg-card">
                  <button
                    type="button"
                    onClick={() => setSpacingModeAndGrid('one_foot')}
                    className={`min-h-11 px-3 py-2 text-xs font-medium transition-all duration-200 active:translate-y-0.5 ${
                      isOneFootGrid
                        ? 'bg-forest text-primary-foreground'
                        : 'text-foreground hover:bg-canvas'
                    }`}
                  >
                    Table vendors (1′ grid)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpacingModeAndGrid('table_provided')}
                    className={`min-h-11 px-3 py-2 text-xs font-medium transition-all duration-200 active:translate-y-0.5 border-l-2 border-stone-200 ${
                      isTableSpacing
                        ? 'bg-forest text-primary-foreground'
                        : 'text-foreground hover:bg-canvas'
                    }`}
                  >
                    Tables (4′+L+3′)
                  </button>
                </div>
                {spacingMode === 'standard' && (
                  <p className="text-[10px] text-amber-800">
                    Legacy 10′ spacing — switch to Table vendors (1′ grid) for market table units.
                  </p>
                )}
              </div>
              {usesTableUnits && (
                <TableSizeSelector
                  value={baselineTableLengthFt}
                  onChange={handleBaselineTableSizeChange}
                />
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Default entrance wall
                </label>
                <div className="flex gap-1">
                  <select
                    value={entrance}
                    onChange={(e) => {
                      const nextEntrance = e.target.value as typeof entrance
                      patchActiveRoom({
                        entrance: nextEntrance,
                        venue_elements:
                          layoutPreset === 'perimeter'
                            ? buildOutsideOnlyVenueElements(gridCols, gridRows, nextEntrance)
                            : refreshPerimeterForEntranceWall(
                                venueElementsWithDoors,
                                nextEntrance,
                                gridCols,
                                gridRows
                              ),
                      })
                    }}
                    className="min-h-11 rounded-lg border-2 border-stone-200 bg-card px-2 py-1.5 text-base focus:outline-none focus:ring-2 focus:ring-harvest-400"
                  >
                    {ENTRANCE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={applyDefaultFixtures}>
                    Apply
                  </Button>
                </div>
              </div>
              <LayoutPresetPicker value={layoutPreset} onChange={handleLayoutPresetChange} />
            </div>
            {usesTableUnits && (
              <TableVendorSpacingPanel
                vendors={[
                  ...approvedApps.map((app) => {
                    const tableLengthFt = baselineTableLengthFt
                    const tableOrientation = resolveTableOrientation(app.id)
                    const cell = cells.find((c) => c.id === app.id)
                    return {
                      id: app.id,
                      vendorName: app.passport?.business_name ?? app.vendor.full_name,
                      boothLabel: layoutBoothLabel(app.booth_number ?? cell?.boothNumber),
                      unitLabel: vendorUnitLabel(undefined, tableLengthFt, tableOrientation),
                      tableLengthFt,
                      tableOrientation,
                    }
                  }),
                  ...fakeVendors
                    .filter((v) => v.vendorUnitType !== 'tent')
                    .map((v) => {
                      const tableLengthFt = baselineTableLengthFt
                      const tableOrientation =
                        v.tableOrientation ?? resolveTableOrientation(v.id)
                      return {
                        id: v.id,
                        vendorName: v.vendorName,
                        boothLabel: layoutBoothLabel(cells.find((c) => c.id === v.id)?.boothNumber),
                        unitLabel: vendorUnitLabel(v.vendorUnitType, tableLengthFt, tableOrientation),
                        tableLengthFt,
                        tableOrientation,
                      }
                    }),
                ]}
                venueTableLengthFt={usesTableUnits ? baselineTableLengthFt : undefined}
                onTableLengthChange={handleTableLengthChange}
                onTableOrientationChange={handleTableOrientationChange}
                showOrientation={isOneFootGrid || spacingMode === 'table_provided'}
              />
            )}
            <p className="text-xs text-muted-foreground rounded-lg border border-stone-200 bg-canvas px-3 py-2">
              Optimized capacity (C<sub>max</sub>): up to{' '}
              <span className="font-semibold text-foreground">{layoutCapacity}</span> vendor units fit with
              mandatory aisles and entrance/exit reserved on a {gridCols} × {gridRows} grid.
            </p>
          </div>
          <LayoutPlannerWizardNav
            currentStep={2}
            onBack={handleWizardBack}
            onNext={handleWizardNext}
          />
        </div>
      )}

      {(canvasOnly || currentStep === 3) && (
        <div className="space-y-4">
          {canvasOnly ? (
            <div className="market-panel space-y-3 p-4">
              <div>
                <h2 className={WIZARD_STEP_TITLE}>
                  Step 4 — Save floor plan
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save the venue shell or auto-place vendors on the canvas. Manual edits are optional — use
                  &ldquo;Save &amp; Deploy Market&rdquo; when ready to publish.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || layoutOverlaps.hasOverlap}
                  onClick={() => void handleSaveBlankLayout()}
                  className="gap-1.5"
                >
                  <Save className="h-4 w-4" />
                  Save blank floor plan
                </Button>
                <Button
                  type="button"
                  disabled={saving || autoPlanRunning || layoutOverlaps.hasOverlap}
                  onClick={() => void handleAutoPlanAndSave()}
                  className="gap-1.5"
                >
                  <Wand2 className="h-4 w-4" />
                  {autoPlanRunning ? 'Placing vendors…' : 'Auto-place vendors & save'}
                </Button>
              </div>
            </div>
          ) : null}
          {!canvasOnly ? (
            <h2 className={cn(WIZARD_STEP_TITLE, 'px-1')}>
              Step 3 — Interactive Floorplan Canvas
            </h2>
          ) : null}

          <Dialog open={clearCanvasOpen} onOpenChange={setClearCanvasOpen}>
            <DialogContent className="sm:max-w-md border-2 border-stone-200">
              <DialogHeader>
                <DialogTitle>Clear your layout?</DialogTitle>
                <DialogDescription>
                  Removes all vendors and fixtures you painted on the canvas. Template walls, doors,
                  and other locked shell elements stay in place.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setClearCanvasOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" variant="destructive" className="min-h-11" onClick={handleClearCanvasConfirm}>
                  Clear Canvas
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,3fr)_minmax(0,1fr)] xl:items-start">
            <aside className="sticky top-3 z-10 flex min-w-0 flex-col gap-2 self-start">
              <FakeVendorsPanel
                compact
                fakeVendorCount={fakeVendors.length}
                layoutCapacity={layoutCapacity}
                maxBoothCapacity={maxBoothCapacity}
                lastFillSummary={lastFillSummary}
                allowsTentVendors={allowsTentVendors}
                tentRestrictionTooltip={TENT_OUTDOOR_ONLY_TOOLTIP}
                randomFillRunning={randomFillRunning || autoPlanRunning}
                seedFillRunning={seedFillRunning}
                onAdd={handleAddFakeVendors}
                onClear={handleClearFakeVendors}
                onAutoFill={handleAutoFillTestVendors}
                onRandomFillToMax={() => void handleRandomFillTestVendorsToMax()}
                onSeedDiverseToMax={() => void handleSeedDiverseApplicationsToMax()}
              />
              <VenueFixturesCatalog activeTool={activeTool} onToolChange={setActiveTool} />
              {!hideRoomBar ? (
                <LayoutRoomBar
                  rooms={rooms}
                  activeRoomId={activeRoomId}
                  onSelectRoom={handleSelectRoom}
                  onAddRoom={handleAddRoom}
                  onRenameRoom={handleRenameRoom}
                  onDeleteRoom={handleDeleteRoom}
                  compact
                />
              ) : null}
              {activeTool === 'custom_label' ? (
                <div className="market-panel flex flex-col gap-1.5 px-3 py-2">
                  <label className="text-[10px] font-medium uppercase text-muted-foreground">Label text</label>
                  <input
                    type="text"
                    value={customLabelDraft}
                    onChange={(e) => {
                      setCustomLabelDraft(e.target.value)
                      paintLabelRef.current = e.target.value.trim() || undefined
                    }}
                    placeholder="Sponsor lounge…"
                    className="rounded-lg border-2 border-stone-200 bg-card px-2 py-1 text-sm"
                  />
                </div>
              ) : null}
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
              {(showOverlapCard ||
                capacityAlertVisible ||
                (layoutAlert && !dismissedAlerts.has('layout-exception'))) && (
                <div className="flex flex-wrap gap-2">
                  {showOverlapCard ? (
                    <DismissibleAlertCard
                      alertId="overlap-booth"
                      title="Layout overlap"
                      variant="error"
                      dismissed={false}
                      onDismiss={dismissAlert}
                      className="min-w-0 flex-1 shrink-0"
                    >
                      <p className="text-xs font-semibold leading-relaxed pr-2">
                        {OVERLAP_RULE_FAILURE_MESSAGE}
                      </p>
                      <p className="text-[10px] mt-1 opacity-90 tabular-nums">
                        {layoutOverlaps.overlapKeys.size} conflicting cell
                        {layoutOverlaps.overlapKeys.size === 1 ? '' : 's'} highlighted in red on the grid.
                      </p>
                    </DismissibleAlertCard>
                  ) : null}
                  {capacityAlertVisible && capacityAlertMessage ? (
                    <DismissibleAlertCard
                      alertId="capacity-reached"
                      title="Capacity reached"
                      variant="warning"
                      dismissed={false}
                      onDismiss={() => {
                        setCapacityAlertVisible(false)
                        dismissAlert('capacity-reached')
                      }}
                      className="min-w-0 flex-1 shrink-0"
                    >
                      <p className="text-xs font-semibold leading-relaxed pr-2">{capacityAlertMessage}</p>
                    </DismissibleAlertCard>
                  ) : null}
                  {layoutAlert && !dismissedAlerts.has('layout-exception') ? (
                    <DismissibleAlertCard
                      alertId="layout-exception"
                      title="Layout exception"
                      variant="error"
                      dismissed={false}
                      onDismiss={dismissAlert}
                      className="min-w-0 flex-1 shrink-0"
                    >
                      <p className="text-xs leading-relaxed pr-2">{layoutAlert}</p>
                    </DismissibleAlertCard>
                  ) : null}
                </div>
              )}

              <section className="relative min-h-0 min-w-0 flex-1">
              {isOneFootGrid && renderGridParams ? (
                <SvgLayoutCanvas
                  cols={gridCols}
                  rows={canvasRows}
                  hallRows={gridRows}
                  cellPx={SVG_FOOT_PX}
                  roomLabel={`${activeRoom.name} · ${gridCols}′ × ${gridRows}′${canvasRows > gridRows ? ' + stage annex' : ''}`}
                  perimeterFacing={{
                    value: manualFacingTarget,
                    onFacingClick: handlePerimeterFacingClick,
                    autoMode: facingAutoMode,
                    suggestedTarget: hoverSuggestedFacing,
                    selectionLabel: selectedPlacedBooth?.vendorName ?? null,
                  }}
                  headerActions={
                    <>
                      <CanvasUtilityToolbar
                        canUndo={layoutHistory.past.length > 0}
                        canRedo={layoutHistory.future.length > 0}
                        onLockAll={handleToggleLockAll}
                        onClear={() => setClearCanvasOpen(true)}
                        onUndo={handleUndo}
                        onRedo={handleRedo}
                        onRemove={() => setActiveTool('eraser')}
                      />
                      <TooltipWrapper text="Auto-place roster vendors with mandatory aisles and entrance/exit reserved">
                        <Button
                          type="button"
                          onClick={() => void handleAutoPlan()}
                          disabled={autoPlanRunning}
                          size="sm"
                          className="gap-1 h-8 px-2 text-xs font-semibold"
                        >
                          <Wand2 className="h-3.5 w-3.5" />
                          {autoPlanRunning ? 'Planning…' : 'Smart Populate Layout'}
                        </Button>
                      </TooltipWrapper>
                      <TooltipWrapper text="Remove all placed vendors from the grid — fixtures stay">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearBooths}
                          className="gap-1 h-8 px-2 text-xs font-semibold text-black"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Clear Booths
                        </Button>
                      </TooltipWrapper>
                      {isOneFootGrid && hasPatronPath ? (
                        <TooltipWrapper text="Toggle dotted patron route from entrance to exit">
                          <Button
                            type="button"
                            variant={showPatronFlow ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setShowPatronFlow((v) => !v)}
                            className="gap-1 h-8 px-2 text-xs"
                          >
                            <Route className="h-3.5 w-3.5" />
                            {showPatronFlow ? 'Hide patron flow' : 'Show patron flow'}
                          </Button>
                        </TooltipWrapper>
                      ) : null}
                    </>
                  }
                >
                  <SvgTemplateLayer
                    rows={canvasRows}
                    hallRows={gridRows}
                    cols={gridCols}
                    cellPx={SVG_FOOT_PX}
                    venueMap={venueMap}
                  />
                  <SvgInteractiveGrid {...renderGridParams} cellPx={SVG_FOOT_PX} />
                  {showPatronFlow && hasPatronPath && patronPathTrace ? (
                    <SvgPatronFlowLayer trace={patronPathTrace} cellPx={SVG_FOOT_PX} />
                  ) : null}
                </SvgLayoutCanvas>
              ) : (
                <>
                  <div
                    className="flex flex-wrap items-center gap-2 border-2 border-black bg-white px-3 py-2 mb-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                    role="toolbar"
                    aria-label="Floor plan actions"
                  >
                    <TooltipWrapper text="Auto-place roster vendors with mandatory aisles and entrance/exit reserved">
                      <Button
                        type="button"
                        onClick={() => void handleAutoPlan()}
                        disabled={autoPlanRunning}
                        size="sm"
                        className="gap-1 h-8 px-2 text-xs font-semibold"
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        {autoPlanRunning ? 'Planning…' : 'Smart Populate Layout'}
                      </Button>
                    </TooltipWrapper>
                    <TooltipWrapper text="Remove all placed vendors from the grid — fixtures stay">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearBooths}
                        className="gap-1 h-8 px-2 text-xs font-semibold text-black"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Clear Booths
                      </Button>
                    </TooltipWrapper>
                  </div>
                  <VirtualizedLayoutCanvas
                    cols={gridCols}
                    rows={gridRows}
                    cellPx={cellPx}
                    renderGrid={renderGridSlice}
                    fitToBounds
                    onGridCellPointerDown={(row, col, event) => {
                      if (activeTool === 'vendor') {
                        event.preventDefault()
                        handlePlaceOnCellClick(col, row)
                        return
                      }
                      onCellPointerDown(row, col)
                    }}
                    onGridCellPointerEnter={(row, col) => {
                      if (activeTool === 'vendor') return
                      onCellPointerEnter(row, col)
                    }}
                    onGridCellDragOver={(row, col) => {
                      if (activeTool !== 'vendor') return
                      setDragHoverCell({ row, col })
                    }}
                    onGridCellDragLeave={() => setDragHoverCell(null)}
                  />
                </>
              )}
            </section>

            {layoutHiddenIds.size > 0 && (
              <div className="rounded-xl border-2 border-dashed border-stone-200 bg-canvas px-3 py-2">
                <p className="text-[10px] text-muted-foreground mb-1.5">
                  {layoutHiddenIds.size} vendor{layoutHiddenIds.size === 1 ? '' : 's'} hidden from this layout
                </p>
                <button
                  type="button"
                  className="text-xs font-medium text-forest hover:underline active:translate-y-0.5"
                  onClick={() => {
                    setLayoutHiddenIds(new Set())
                    toast.message('Hidden vendors restored to the plan')
                  }}
                >
                  Restore hidden vendors
                </button>
              </div>
            )}
            {vendorInputs.length === 0 ? (
              <div className="rounded-2xl border-2 border-stone-200 bg-card shadow-[var(--shadow-market)] p-3">
                <p className="text-xs text-muted-foreground">
                  Add test vendors in the left panel or run Smart Populate Layout to fill the canvas.
                </p>
              </div>
            ) : (
              <UnplacedVendorsPanel
                vendors={overflow}
                activeTool={activeTool}
                selectedId={selectedVendorId}
                cellWidthFt={gridConfig.cellWidthFt}
                cellLengthFt={gridConfig.cellLengthFt}
                isOneFootGrid={isOneFootGrid}
                onSelect={setSelectedVendorId}
                onDragStart={handleUnplacedDragStart}
                onRemove={handleRemoveVendorFromPlan}
              />
            )}
            </div>

            <aside className="sticky top-3 flex min-w-0 flex-col gap-2 self-start">
              <article className="market-panel space-y-2 p-3" aria-label="Your selections">
                <h3 className={cn(WIZARD_SECTION_LABEL, 'border-b border-stone-200/80 pb-1.5')}>
                  Your Selections
                </h3>
                <ul className="space-y-2 text-xs">
                  <li>
                    <span className={WIZARD_SUMMARY_META_LABEL}>Room</span>
                    <p className={WIZARD_SUMMARY_VALUE_EMPHASIS}>{activeRoom.name}</p>
                  </li>
                  <li>
                    <span className={WIZARD_SUMMARY_META_LABEL}>Grid</span>
                    <p className={cn(WIZARD_SUMMARY_VALUE, 'tabular-nums')}>
                      {gridCols} × {gridRows} · {placed.length} placed
                      {layoutCells.length > placed.length
                        ? ` · ${layoutCells.length - placed.length} unplaced`
                        : ''}
                    </p>
                  </li>
                  <li>
                    <span className={WIZARD_SUMMARY_META_LABEL}>Capacity</span>
                    <p className={WIZARD_SUMMARY_VALUE_WARN}>
                      Max booths: {maxBoothCapacity}
                      <span className="block text-xs mt-0.5 text-muted-foreground">
                        ~{layoutCapacity} fit with aisles · {baselineTableLengthFt}&apos; baseline table
                      </span>
                    </p>
                  </li>
                  <li>
                    <span className={WIZARD_SUMMARY_META_LABEL}>Entrance</span>
                    <p className={cn(WIZARD_SUMMARY_VALUE_SAGE, 'capitalize')}>{entrance}</p>
                  </li>
                </ul>
                <TooltipWrapper text="Drag doors on outer walls, or use Entrance (E) / Exit (X). Paint fixtures or run Smart Populate when the canvas is empty.">
                  <p className="cursor-default text-[10px] font-medium tabular-nums text-muted-foreground">
                    {lockedFixtureCount > 0 ? `${lockedFixtureCount} locked · ` : ''}
                    {layoutOverlaps.hasOverlap ? 'overlap · ' : ''}
                    {showStrollerOverlays && strollerClearance.hasBottleneck
                      ? 'stroller warnings'
                      : 'layout clear'}
                  </p>
                </TooltipWrapper>
              </article>

              <div className="market-panel p-3">
                <LayoutPresetPicker
                  value={layoutPreset}
                  onChange={handleLayoutPresetChange}
                  compact
                />
              </div>

              <MarketFeedbackAdminPanel marketId={eventId} refreshToken={feedbackRefreshToken} />

              <MarketFeedbackWidget
                marketId={eventId}
                compact
                onSubmitted={() => setFeedbackRefreshToken((n) => n + 1)}
                layoutConflict={
                  layoutOverlaps.hasOverlap
                    ? {
                        roomName: activeRoom.name,
                        overlapCount: layoutOverlaps.overlapKeys.size,
                        contextId: activeRoomId,
                      }
                    : null
                }
              />

            </aside>
          </div>

          {canvasMounted ? (
            <LayoutQaLogPanel
              live={liveLayoutQa.live}
              liveRegression={liveLayoutQa.regression}
              liveRegressionRunning={liveLayoutQa.regressionRunning}
            />
          ) : null}
          {!hideInternalNav ? (
            <LayoutPlannerWizardNav
              currentStep={3}
              onBack={handleWizardBack}
              onNext={handleWizardNext}
            />
          ) : null}
        </div>
      )}

      {!canvasOnly && currentStep === 4 && (
        <div className="space-y-4">
          <div className="market-panel p-4 space-y-4">
            <h2 className={WIZARD_STEP_TITLE}>
              Step 4 — Regression QA, Printing &amp; Export
            </h2>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || layoutOverlaps.hasOverlap}
                className="gap-1.5"
                title={
                  layoutOverlaps.hasOverlap
                    ? 'Resolve overlapping booths before saving'
                    : undefined
                }
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Layout'}
              </Button>
              <Link
                href={`/coordinator/events/${eventId}/print/all`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5 min-h-11 inline-flex items-center print:hidden')}
              >
                Print Roster &amp; Floorplan
              </Link>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,320px)]">
              <PureLayoutPreview
                cells={cells}
                venueElements={venueElementsWithDoors}
                roomName={activeRoom.name}
              />
              <div className="flex flex-col gap-3">
                <VendorCategorySummary
                  summaries={categorySummaries}
                  totalVendors={layoutCells.length}
                />
                <StrollerClearancePanel
                  hasBottleneck={strollerClearance.hasBottleneck}
                  bottleneckCount={strollerClearance.bottleneckKeys.size}
                  dismissed={dismissedAlerts.has('stroller-bottleneck')}
                  onDismiss={() => dismissAlert('stroller-bottleneck')}
                />
                {showOverlapCard ? (
                  <DismissibleAlertCard
                    alertId="overlap-booth"
                    title="Layout overlap"
                    variant="error"
                    dismissed={false}
                    onDismiss={dismissAlert}
                  >
                    <p className="text-xs font-semibold leading-relaxed pr-2">
                      {OVERLAP_RULE_FAILURE_MESSAGE}
                    </p>
                  </DismissibleAlertCard>
                ) : null}
              </div>
            </div>
            <LayoutQaLogPanel
              live={liveLayoutQa.live}
              liveRegression={liveLayoutQa.regression}
              liveRegressionRunning={liveLayoutQa.regressionRunning}
            />
          </div>
          <LayoutPlannerWizardNav
            currentStep={4}
            onBack={handleWizardBack}
            showBack
          />
        </div>
      )}
    </div>
  )
}

function BottleneckOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div
      className="absolute inset-0 bg-harvest-400/35 pointer-events-none rounded z-[1]"
      aria-hidden
    />
  )
}

function OverlapConflictOverlay({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <div
      className="absolute inset-0 overlap-conflict-cell z-[6]"
      aria-hidden
    />
  )
}

function GridCellGlyph({ letter }: { letter: string }) {
  return (
    <span
      className="pointer-events-none absolute inset-0 z-[4] flex items-center justify-center text-[11px] font-heading font-bold text-charcoal/80 select-none"
      aria-hidden
    >
      {formatCellGlyph(letter)}
    </span>
  )
}

function ClientFrontageArrow({ side }: { side: 'top' | 'bottom' | 'left' | 'right' }) {
  const Icon =
    side === 'top'
      ? ArrowUp
      : side === 'bottom'
        ? ArrowDown
        : side === 'left'
          ? ArrowLeft
          : ArrowRight
  return (
    <span
      className={cn(
        'pointer-events-none absolute z-[5] flex h-5 w-5 items-center justify-center rounded-full bg-forest/90 text-primary-foreground shadow-sm',
        FRONTAGE_ARROW_CLASS[side]
      )}
      aria-hidden
    >
      <Icon className="h-3 w-3" />
    </span>
  )
}

function TableLengthDirectionIndicator({
  orientation,
}: {
  orientation: 'horizontal' | 'vertical'
}) {
  const Icon = orientation === 'horizontal' ? ArrowLeftRight : ArrowUpDown
  return (
    <span
      className="pointer-events-none absolute bottom-0.5 left-0.5 z-[4] flex h-4 w-4 items-center justify-center rounded bg-card/90 text-muted-foreground shadow-sm"
      title={orientation === 'horizontal' ? 'Table length E-W' : 'Table length N-S'}
      aria-hidden
    >
      <Icon className="h-2.5 w-2.5" />
    </span>
  )
}

function renderClearanceRingDiv(
  r: number,
  c: number,
  tone: 'active' | 'target' | 'active-overlap' | 'target-overlap',
  toLocalCol: (c: number) => number,
  toLocalRow: (r: number) => number
) {
  const overlap = tone.includes('overlap')
  const isActive = tone.startsWith('active')
  return (
    <div
      key={`ring-${tone}-${r}-${c}`}
      style={{
        gridColumn: `${toLocalCol(c) + 1} / span 1`,
        gridRow: `${toLocalRow(r) + 1} / span 1`,
      }}
      className={cn(
        'pointer-events-none z-[3] border',
        overlap
          ? 'animate-pulse border-red-700 bg-red-500/40'
          : isActive
            ? 'border-amber-600 bg-amber-400/30'
            : 'border-blue-600 bg-blue-400/30'
      )}
    />
  )
}

function renderGrid({
  rows,
  cols,
  cellMap,
  venueMap,
  blocked,
  bottleneckKeys,
  overlapKeys,
  showBottleneckOverlay,
  activeTool,
  entrance,
  isOneFootGrid,
  hallRows,
  onCellPointerDown,
  onCellPointerEnter,
  onToggleFixtureLock,
  handleDragStart,
  handleDrop,
  onDoorDragStart,
  onVendorPlaceClick,
  onUnplaceVendor,
  onRotateTable,
  cellWidthFt,
  cellLengthFt,
  clearanceOverlay,
  onDragHover,
  onDragHoverEnd,
  slice,
}: {
  rows: number
  cols: number
  cellMap: Map<string, BoothCell>
  venueMap: Map<string, VenueElement>
  blocked: Set<string>
  bottleneckKeys: Set<string>
  overlapKeys: Set<string>
  showBottleneckOverlay: boolean
  activeTool: LayoutTool
  entrance: 'north' | 'south' | 'east' | 'west'
  isOneFootGrid: boolean
  hallRows: number
  onCellPointerDown: (row: number, col: number) => void
  onCellPointerEnter: (row: number, col: number) => void
  onToggleFixtureLock: (elementId: string) => void
  handleDragStart: (e: React.DragEvent, col: number, row: number) => void
  handleDrop: (e: React.DragEvent, col: number, row: number) => void
  onDoorDragStart: (e: React.DragEvent, doorType: 'entrance' | 'exit') => void
  onVendorPlaceClick: (col: number, row: number) => void
  onUnplaceVendor: (cell: BoothCell) => void
  onRotateTable: (cell: BoothCell) => void
  cellWidthFt: number
  cellLengthFt: number
  clearanceOverlay?: DualRingOverlayResult | null
  onDragHover?: (row: number, col: number) => void
  onDragHoverEnd?: () => void
  slice?: QuadrantBounds
}) {
  const elements: React.ReactElement[] = []
  const rendered = new Set<string>()
  const rStart = slice?.row0 ?? 0
  const rEnd = slice?.row1 ?? rows - 1
  const cStart = slice?.col0 ?? 0
  const cEnd = slice?.col1 ?? cols - 1
  const toLocalCol = (c: number) => (slice ? c - slice.col0 : c)
  const toLocalRow = (r: number) => (slice ? r - slice.row0 : r)

  if (clearanceOverlay) {
    const overlap = clearanceOverlay.hasOverlap
    const seen = new Set<string>()
    for (const ring of clearanceOverlay.activeRings) {
      if (ring.kind !== 'buffer') continue
      if (ring.r < rStart || ring.r > rEnd || ring.c < cStart || ring.c > cEnd) continue
      const key = `active-${ring.r}-${ring.c}`
      if (seen.has(key)) continue
      seen.add(key)
      elements.push(
        renderClearanceRingDiv(
          ring.r,
          ring.c,
          overlap ? 'active-overlap' : 'active',
          toLocalCol,
          toLocalRow
        )
      )
    }
    for (const ring of clearanceOverlay.targetRings) {
      if (ring.kind !== 'buffer') continue
      if (ring.r < rStart || ring.r > rEnd || ring.c < cStart || ring.c > cEnd) continue
      const key = `target-${ring.r}-${ring.c}`
      if (seen.has(key)) continue
      seen.add(key)
      elements.push(
        renderClearanceRingDiv(
          ring.r,
          ring.c,
          overlap ? 'target-overlap' : 'target',
          toLocalCol,
          toLocalRow
        )
      )
    }
  }

  for (let r = rStart; r <= rEnd; r++) {
    for (let c = cStart; c <= cEnd; c++) {
      const key = `${r}-${c}`
      if (rendered.has(key)) continue

      const booth = cellMap.get(key)
      if (booth && booth.col === c && booth.row === r) {
        for (let dr = 0; dr < booth.rowSpan; dr++) {
          for (let dc = 0; dc < booth.colSpan; dc++) {
            rendered.add(`${r + dr}-${c + dc}`)
          }
        }
        const boothTypeBorder =
          booth.boothType === 'wall'
            ? 'border-amber-700 border-2'
            : booth.boothType === 'power'
            ? 'border-yellow-400 border-2'
            : 'border-2'
        const tableDirection =
          !isTentVendor(booth.vendorUnitType) && isOneFootGrid
            ? booth.tableOrientation ??
              inferTableOrientation(
                booth.colSpan,
                booth.rowSpan,
                booth.tableLengthFt ?? undefined
              )
            : null

        elements.push(
          <div
            key={`booth-${booth.id}`}
            draggable={activeTool === 'vendor'}
            onDragStart={(e) => handleDragStart(e, c, r)}
            onDragOver={(e) => {
              e.preventDefault()
              onDragHover?.(r, c)
            }}
            onDrop={(e) => {
              onDragHoverEnd?.()
              handleDrop(e, c, r)
            }}
            onMouseDown={(e) => {
              if (activeTool === 'eraser') {
                e.preventDefault()
                e.stopPropagation()
                onUnplaceVendor(booth)
              }
            }}
            style={{
              gridColumn: `${toLocalCol(c) + 1} / span ${booth.colSpan}`,
              gridRow: `${toLocalRow(r) + 1} / span ${booth.rowSpan}`,
            }}
            title={gridCellTooltip({
              booth: {
                vendorName: booth.vendorName,
                boothNumber: booth.boothNumber,
                footprint: formatBoothFootprint(booth.colSpan, booth.rowSpan, cellWidthFt, cellLengthFt),
                unitLabel: vendorUnitLabel(
                  booth.vendorUnitType,
                  booth.tableLengthFt,
                  tableDirection
                ),
              },
            })}
            className={`relative rounded-lg p-1 pt-4 flex flex-col justify-between overflow-hidden select-none transition-shadow hover:shadow-md ${booth.categoryColor} ${boothTypeBorder} ${
              isFakeVendorId(booth.id) ? 'ring-2 ring-violet-400 ring-offset-1' : ''
            } ${
              activeTool === 'vendor'
                ? 'cursor-grab active:cursor-grabbing'
                : activeTool === 'eraser'
                  ? 'pointer-events-auto cursor-pointer hover:ring-2 hover:ring-red-300'
                  : 'pointer-events-none opacity-90'
            }`}
          >
            {(activeTool === 'vendor' || activeTool === 'eraser') && (
              <>
                {!isTentVendor(booth.vendorUnitType) && activeTool === 'vendor' && (
                  <button
                    type="button"
                    title="Rotate table direction"
                    aria-label={`Rotate table for ${booth.vendorName}`}
                    className="absolute top-0.5 left-0.5 z-10 rounded p-0.5 bg-card/90 text-muted-foreground hover:text-harvest-700 hover:bg-card shadow-sm"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      onRotateTable(booth)
                    }}
                  >
                    <RotateCw className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  title="Unplace vendor (move to sidebar)"
                  aria-label={`Unplace ${booth.vendorName}`}
                  className="absolute top-0.5 right-0.5 z-10 rounded p-0.5 bg-card/90 text-muted-foreground hover:text-terracotta-700 hover:bg-card shadow-sm"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnplaceVendor(booth)
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </>
            )}
            <OverlapConflictOverlay
              show={(() => {
                for (let dr = 0; dr < booth.rowSpan; dr++) {
                  for (let dc = 0; dc < booth.colSpan; dc++) {
                    if (overlapKeys.has(`${r + dr}-${c + dc}`)) return true
                  }
                }
                return false
              })()}
            />
            <BottleneckOverlay
              show={
                showBottleneckOverlay &&
                (() => {
                  for (let dr = 0; dr < booth.rowSpan; dr++) {
                    for (let dc = 0; dc < booth.colSpan; dc++) {
                      if (bottleneckKeys.has(`${r + dr}-${c + dc}`)) return true
                    }
                  }
                  return false
                })()
              }
            />
            <ClientFrontageArrow
              side={
                isOneFootGrid && !isTentVendor(booth.vendorUnitType)
                  ? effectiveStorefrontSide(
                      booth.facingTarget,
                      entrance,
                      r,
                      c,
                      hallRows,
                      cols
                    )
                  : clientFrontageSide(entrance)
              }
            />
            {tableDirection && <TableLengthDirectionIndicator orientation={tableDirection} />}
            {(() => {
              const labelSide =
                isOneFootGrid && !isTentVendor(booth.vendorUnitType)
                  ? effectiveStorefrontSide(
                      booth.facingTarget,
                      entrance,
                      r,
                      c,
                      hallRows,
                      cols
                    )
                  : clientFrontageSide(entrance)
              const labelPos = storefrontLabelCssPosition(labelSide)
              return (
                <div
                  className="absolute z-[1] flex max-w-[92%] flex-col items-center gap-0.5 text-center leading-tight"
                  style={{
                    ...labelPos,
                    transform: storefrontLabelCssTransform(labelSide),
                  }}
                >
                  <p className="max-w-full truncate text-[9px] font-bold">{booth.vendorName}</p>
                  <span className="max-w-full truncate text-[7px] font-semibold opacity-70">
                    {vendorUnitLabel(booth.vendorUnitType, booth.tableLengthFt, tableDirection)}
                  </span>
                  <span className="text-[8px] font-bold opacity-60">#{booth.boothNumber}</span>
                </div>
              )
            })()}
            <div className="pointer-events-none flex flex-1 items-center justify-center min-h-0 px-0.5 opacity-40">
              <MarketStallIcon
                className={cn(
                  'h-[1cm] w-[1cm] max-h-[50%] max-w-[50%] shrink-0',
                  tableDirection === 'vertical' && 'rotate-90'
                )}
              />
            </div>
          </div>
        )
        continue
      }

      const fixture = venueMap.get(key)
      if (fixture && isElementOrigin(fixture, r, c)) {
        const spanC = fixture.colSpan ?? 1
        const spanR = fixture.rowSpan ?? 1
        for (let dr = 0; dr < spanR; dr++) {
          for (let dc = 0; dc < spanC; dc++) {
            rendered.add(`${r + dr}-${c + dc}`)
          }
        }
        const style = ELEMENT_STYLES[fixture.type]
        const Icon = ELEMENT_ICONS[fixture.type]
        const isPerimeterWall = isPerimeterWallElement(fixture, cols, rows)
        const isWalkway = fixture.type === 'aisle'
        const fixtureLabel = fixtureCanvasLabel(fixture, cols, rows)
        const isMovableDoor =
          (fixture.type === 'entrance' || fixture.type === 'exit') && !fixture.locked
        elements.push(
          <div
            key={`fixture-${fixture.id}`}
            role="button"
            tabIndex={0}
            draggable={isMovableDoor}
            onDragStart={(e) =>
              isMovableDoor && onDoorDragStart(e, fixture.type as 'entrance' | 'exit')
            }
            onMouseDown={(e) => {
              if (isMovableDoor) {
                e.preventDefault()
                return
              }
              if (isPerimeterWall) return
              e.preventDefault()
              onCellPointerDown(r, c)
            }}
            onMouseEnter={() => {
              if (!isPerimeterWall) onCellPointerEnter(r, c)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              onDragHover?.(r, c)
            }}
            onDrop={(e) => {
              onDragHoverEnd?.()
              handleDrop(e, c, r)
            }}
            style={{
              gridColumn: `${toLocalCol(c) + 1} / span ${spanC}`,
              gridRow: `${toLocalRow(r) + 1} / span ${spanR}`,
            }}
            title={
              isPerimeterWall
                ? 'Perimeter wall'
                : gridCellTooltip({
                    fixture: { label: fixtureLabel || fixture.type, type: fixture.type },
                  })
            }
            className={
              isPerimeterWall
                ? 'relative bg-stone-500 cursor-default pointer-events-none'
                : `group/fixture relative flex flex-col items-center justify-center gap-0.5 rounded-lg p-1 pt-4 text-center ${style.className} ${
                    isMovableDoor
                      ? 'cursor-grab active:cursor-grabbing ring-1 ring-black/10'
                      : 'cursor-crosshair'
                  } ${fixture.locked ? 'ring-2 ring-slate-600 shadow-sm' : ''}`
            }
          >
            {!isPerimeterWall && (
              <>
            <OverlapConflictOverlay
              show={Array.from({ length: spanR }, (_, dr) =>
                Array.from({ length: spanC }, (_, dc) =>
                  overlapKeys.has(`${r + dr}-${c + dc}`)
                )
              )
                .flat(2)
                .some(Boolean)}
            />
            <BottleneckOverlay
              show={
                showBottleneckOverlay &&
                Array.from({ length: spanR }, (_, dr) =>
                  Array.from({ length: spanC }, (_, dc) =>
                    bottleneckKeys.has(`${r + dr}-${c + dc}`)
                  )
                )
                  .flat(2)
                  .some(Boolean)
              }
            />
            {(() => {
              const glyph = fixtureGlyph(fixture.type, fixture.locked)
              return glyph ? <GridCellGlyph letter={glyph} /> : null
            })()}
            <button
              type="button"
              title={fixture.locked ? 'Unlock this fixture' : 'Lock this fixture'}
              aria-label={fixture.locked ? 'Unlock fixture' : 'Lock fixture'}
              className={`absolute top-0.5 right-0.5 z-10 rounded p-0.5 transition-colors ${
                fixture.locked
                  ? 'bg-slate-700 text-white hover:bg-slate-800'
                  : 'bg-card/90 text-muted-foreground hover:text-foreground hover:bg-card shadow-sm opacity-80 group-hover/fixture:opacity-100'
              }`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onToggleFixtureLock(fixture.id)
              }}
            >
              {fixture.locked ? (
                <Lock className="h-3 w-3" />
              ) : (
                <LockOpen className="h-3 w-3" />
              )}
            </button>
            {Icon && !isWalkway && <Icon className="h-4 w-4 shrink-0 opacity-80" />}
            {!isWalkway ? (
              <span className="text-[8px] font-bold uppercase leading-tight px-0.5">
                {fixtureLabel}
              </span>
            ) : null}
              </>
            )}
          </div>
        )
        continue
      }

      if (fixture) {
        rendered.add(key)
        continue
      }

      // Vacant cells are not rendered — grid lines + pointer layer handle empty space.
    }
  }

  return elements
}
