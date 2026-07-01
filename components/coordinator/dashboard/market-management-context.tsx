'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { coordinatorStudioHref } from '@/lib/coordinator/coordinator-routes'
import type { LayoutRoom } from '@/types/database'
import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  deriveBoothPlacementStatus,
  type BoothPlacementStatus,
  type VendorApplicationSnapshot,
} from './booth-placement-status'
import {
  approvedVendorsNotOnCanvas,
  boothVendorIdReconciliationPatches,
  pickBoothForApplication,
} from '@/lib/coordinator/dashboard-vendor-placement'
import type { FloorPlanLayoutActions } from '@/lib/coordinator/floor-plan-layout-actions'
import { populateTestSuiteCanvas } from '@/lib/coordinator/populate-test-suite-canvas'
import { formatCadCurrency } from '@/lib/coordinator/booth-placement-status'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'
import { docHasUnresolvedClearanceIssues } from '@/lib/coordinator/booth-clearance-visual'
import {
  readHubGridLayoutMode,
  type HubGridLayoutMode,
} from '@/lib/floor-plan/hubgrid-layout-mode'

export interface DashboardEventSummary {
  id: string
  name: string
  start_at: string
  status: string
  location_name?: string | null
  address?: string | null
  isExternalListing?: boolean
  destinationUrl?: string | null
  adCampaignStatus?: string | null
}

export interface EventLayoutBundle {
  rooms: LayoutRoom[]
  activeRoomId: string
}

export interface MarketTelemetry {
  totalBooths: number
  assignedBooths: number
  paidBooths: number
  vipHoldBooths: number
  unassignedBooths: number
  collectedRevenueCents: number
  pendingRevenueCents: number
  squareConnected: boolean
  stripeConnected: boolean
}

export interface MarketManagementState {
  events: DashboardEventSummary[]
  selectedEventId: string | null
  setSelectedEventId: (id: string) => void
  pendingApplications: VendorApplicationSnapshot[]
  approvedPool: VendorApplicationSnapshot[]
  layoutRooms: LayoutRoom[]
  layoutActiveRoomId: string
  setLayoutRooms: (rooms: LayoutRoom[], activeRoomId: string) => void
  floorPlanStore: FloorPlanDocStore | null
  registerFloorPlanStore: (store: FloorPlanDocStore | null) => void
  selectedBoothId: string | null
  setSelectedBoothId: (id: string | null) => void
  boothStatusByObjectId: ReadonlyMap<string, BoothPlacementStatus>
  telemetry: MarketTelemetry
  vipHoldApplicationIds: ReadonlySet<string>
  toggleVipHold: (applicationId: string) => void
  assignVendorToBooth: (boothId: string, application: VendorApplicationSnapshot) => void
  assignVendorToBoothByVendorId: (boothId: string, vendorId: string | null) => void
  unassignBooth: (boothId: string) => void
  autoSeatApprovedVendors: () => number
  refreshApprovedPool: (eventId: string) => Promise<VendorApplicationSnapshot[]>
  registerFloorPlanLayoutActions: (actions: FloorPlanLayoutActions | null) => void
  populateTestSuiteOnCanvas: (eventId: string) => Promise<{
    vendors: number
    tableSlots: number
    boothsFilled: number
    boothsAssigned: number
    boothsRequested: number
    canvasReady: boolean
    roomName?: string | null
    error?: string
  }>
  focusBooth: (boothId: string) => void
  totalRevenueCents: number
  /** True when any vendor booth violates the 3′ clearance baseline (Pro mode only). */
  hasClearanceIssues: boolean
  hubGridLayoutMode: HubGridLayoutMode
  setHubGridLayoutMode: (mode: HubGridLayoutMode) => void
  /** Vendor booths on the live canvas (all rooms). */
  canvasVendorBoothCount: number
  /** Event category cap names for booth tagging and palette rotation. */
  eventCategoryNames: string[]
  /** Flip external listing tier after native migration without full reload. */
  patchEventListingMode: (eventId: string, isExternalListing: boolean) => void
}

const MarketManagementContext = createContext<MarketManagementState | null>(null)

export function useOptionalMarketManagement(): MarketManagementState | null {
  return useContext(MarketManagementContext)
}

export function useMarketManagement(): MarketManagementState {
  const ctx = useContext(MarketManagementContext)
  if (!ctx) {
    throw new Error('useMarketManagement must be used within MarketManagementProvider')
  }
  return ctx
}

interface MarketManagementProviderProps {
  children: ReactNode
  events: DashboardEventSummary[]
  initialEventId: string | null
  layoutsByEventId: Record<string, EventLayoutBundle>
  approvedByEventId: Record<string, VendorApplicationSnapshot[]>
  pendingByEventId: Record<string, VendorApplicationSnapshot[]>
  boothPriceByEventAndApplicationId: Record<string, Record<string, number>>
  eventCategoryNamesByEventId?: Record<string, string[]>
  squareConnected: boolean
  stripeConnected?: boolean
  totalRevenueCents: number
}

export function MarketManagementProvider({
  children,
  events,
  initialEventId,
  layoutsByEventId,
  approvedByEventId,
  pendingByEventId,
  boothPriceByEventAndApplicationId,
  eventCategoryNamesByEventId = {},
  squareConnected,
  stripeConnected = false,
  totalRevenueCents,
}: MarketManagementProviderProps) {
  const router = useRouter()
  const resolvedInitialEventId =
    initialEventId && events.some((event) => event.id === initialEventId) ? initialEventId : null
  const [eventsState, setEventsState] = useState(events)
  const [selectedEventId, setSelectedEventIdState] = useState(resolvedInitialEventId)

  useEffect(() => {
    setEventsState(events)
  }, [events])

  const patchEventListingMode = useCallback((eventId: string, isExternalListing: boolean) => {
    setEventsState((prev) =>
      prev.map((event) =>
        event.id === eventId ? { ...event, isExternalListing } : event
      )
    )
  }, [])

  const setSelectedEventId = useCallback(
    (id: string) => {
      if (!eventsState.some((event) => event.id === id)) return
      setSelectedEventIdState(id)
      router.replace(coordinatorStudioHref(id), { scroll: false })
    },
    [eventsState, router]
  )
  const [approvedByEventIdState, setApprovedByEventIdState] =
    useState(approvedByEventId)

  useEffect(() => {
    setApprovedByEventIdState(approvedByEventId)
  }, [approvedByEventId])

  const initialLayout = selectedEventId ? layoutsByEventId[selectedEventId] : undefined
  const [layoutRooms, setLayoutRoomsState] = useState<LayoutRoom[]>(
    initialLayout?.rooms ?? []
  )
  const [layoutActiveRoomId, setLayoutActiveRoomId] = useState(
    initialLayout?.activeRoomId ?? ''
  )
  const [floorPlanStore, setFloorPlanStore] = useState<FloorPlanDocStore | null>(null)
  const [floorPlanLayoutActions, setFloorPlanLayoutActions] =
    useState<FloorPlanLayoutActions | null>(null)
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null)
  const [vipHoldIds, setVipHoldIds] = useState<Set<string>>(() => new Set())
  const [docRevision, setDocRevision] = useState(0)
  const [hubGridLayoutMode, setHubGridLayoutModeState] = useState<HubGridLayoutMode>(() =>
    typeof window !== 'undefined' ? readHubGridLayoutMode() : 'simple'
  )
  const setHubGridLayoutMode = useCallback((mode: HubGridLayoutMode) => {
    setHubGridLayoutModeState(mode)
  }, [])
  const prevSelectedEventIdRef = useRef(selectedEventId)

  useEffect(() => {
    if (!selectedEventId) return
    const bundle = layoutsByEventId[selectedEventId]
    if (!bundle) return

    const eventChanged = prevSelectedEventIdRef.current !== selectedEventId
    prevSelectedEventIdRef.current = selectedEventId

    setLayoutRoomsState((prev) => {
      // router.refresh() after test-suite seed can re-fetch an empty server
      // layout while the coordinator already created a room in memory — keep
      // the live canvas footprint instead of bouncing to "Set up your floor plan".
      if (!eventChanged && bundle.rooms.length === 0 && prev.length > 0) {
        return prev
      }
      return bundle.rooms
    })

    if (eventChanged || bundle.rooms.length > 0) {
      setLayoutActiveRoomId(bundle.activeRoomId)
      setSelectedBoothId(null)
      setFloorPlanStore(null)
    }
  }, [layoutsByEventId, selectedEventId])

  const approvedPool = useMemo(
    () => (selectedEventId ? approvedByEventIdState[selectedEventId] ?? [] : []),
    [approvedByEventIdState, selectedEventId]
  )

  const refreshApprovedPool = useCallback(async (eventId: string) => {
    const response = await fetch(`/api/coordinator/events/${eventId}/application-pool`)
    if (!response.ok) return []
    const body = (await response.json()) as {
      approved?: VendorApplicationSnapshot[]
    }
    const approved = body.approved ?? []
    setApprovedByEventIdState((prev) => ({
      ...prev,
      [eventId]: approved,
    }))
    return approved
  }, [])

  const registerFloorPlanLayoutActions = useCallback(
    (actions: FloorPlanLayoutActions | null) => {
      setFloorPlanLayoutActions(actions)
    },
    []
  )

  const populateTestSuiteOnCanvas = useCallback(
    async (eventId: string) => {
      const approved = await refreshApprovedPool(eventId)

      if (!floorPlanStore) {
        return {
          vendors: approved.length,
          tableSlots: approved.reduce(
            (sum, application) => sum + Math.max(1, application.tableCount ?? 1),
            0
          ),
          boothsFilled: 0,
          boothsAssigned: 0,
          boothsRequested: 0,
          canvasReady: false,
          roomName: null,
          error:
            'Floor plan is still loading — wait for the canvas, then click Test suite again.',
        }
      }

      const result = populateTestSuiteCanvas({
        store: floorPlanStore,
        activeRoomId: layoutActiveRoomId,
        approved,
      })

      if (result.boothsPlaced > 0 || result.boothsAssigned > 0) {
        setDocRevision((revision) => revision + 1)
      }

      return {
        vendors: result.vendors,
        tableSlots: result.tableSlots,
        boothsFilled: result.boothsPlaced,
        boothsAssigned: result.boothsAssigned,
        boothsRequested: result.boothsRequested,
        canvasReady: result.canvasReady,
        roomName: result.roomName,
        error: result.error,
      }
    },
    [floorPlanStore, layoutActiveRoomId, refreshApprovedPool]
  )

  const pendingApplications = useMemo(
    () => (selectedEventId ? pendingByEventId[selectedEventId] ?? [] : []),
    [pendingByEventId, selectedEventId]
  )

  const boothPriceByApplicationId = useMemo(() => {
    if (!selectedEventId) return new Map<string, number>()
    const row = boothPriceByEventAndApplicationId[selectedEventId] ?? {}
    return new Map(Object.entries(row).map(([k, v]) => [k, v]))
  }, [boothPriceByEventAndApplicationId, selectedEventId])

  const appByVendorId = useMemo(() => {
    const map = new Map<string, VendorApplicationSnapshot>()
    for (const app of approvedPool) {
      map.set(app.vendor_id, app)
    }
    return map
  }, [approvedPool])

  const appByApplicationId = useMemo(() => {
    const map = new Map<string, VendorApplicationSnapshot>()
    for (const app of approvedPool) {
      map.set(app.id, app)
    }
    return map
  }, [approvedPool])

  const registerFloorPlanStore = useCallback(
    (store: FloorPlanDocStore | null) => {
      if (!store) {
        // Canvas unmount (e.g. Ledger tab) must not wipe live doc — event
        // switch clears store in the selectedEventId effect below.
        return
      }
      if (approvedPool.length > 0) {
        const booths = store.doc.objects.filter(
          (o): o is BoothObject => o.kind === 'booth'
        )
        const patches = boothVendorIdReconciliationPatches(booths, approvedPool)
        for (const patch of patches) {
          store.updateObject(
            patch.boothId,
            {
              vendorId: patch.vendorId,
              label: patch.label,
              categoryName: patch.categoryName,
            } as Partial<BoothObject>,
            { pushHistory: false }
          )
        }
        if (patches.length > 0) {
          setDocRevision((n) => n + 1)
        }
      }
      setFloorPlanStore(store)
    },
    [approvedPool]
  )

  useEffect(() => {
    if (!floorPlanStore) return
    setDocRevision((n) => n + 1)
  }, [floorPlanStore?.doc, floorPlanStore?.selectedIds])

  const boothStatusByObjectId = useMemo(() => {
    void docRevision
    const map = new Map<string, BoothPlacementStatus>()
    if (!floorPlanStore) return map
    for (const obj of floorPlanStore.doc.objects) {
      if (obj.kind !== 'booth') continue
      const booth = obj as BoothObject
      if (isGuestTableBooth(booth)) continue
      map.set(
        booth.id,
        deriveBoothPlacementStatus(
          booth,
          appByVendorId,
          vipHoldIds,
          appByApplicationId
        )
      )
    }
    return map
  }, [appByVendorId, docRevision, floorPlanStore, vipHoldIds])

  const telemetry = useMemo((): MarketTelemetry => {
    void docRevision
    let totalBooths = 0
    let assignedBooths = 0
    let paidBooths = 0
    let vipHoldBooths = 0
    let collectedRevenueCents = 0
    let pendingRevenueCents = 0

    if (floorPlanStore) {
      for (const obj of floorPlanStore.doc.objects) {
        if (obj.kind !== 'booth') continue
        const booth = obj as BoothObject
        if (isGuestTableBooth(booth)) continue
        totalBooths += 1
        if (!booth.vendorId) continue
        assignedBooths += 1
        const status = deriveBoothPlacementStatus(
          booth,
          appByVendorId,
          vipHoldIds,
          appByApplicationId
        )
        const app =
          appByVendorId.get(booth.vendorId!) ??
          appByApplicationId.get(booth.vendorId!)
        const price = app ? boothPriceByApplicationId.get(app.id) ?? 0 : 0
        if (status === 'paid') {
          paidBooths += 1
          collectedRevenueCents += price
        } else if (status === 'vip_hold') {
          vipHoldBooths += 1
        } else if (status === 'assigned_unpaid') {
          pendingRevenueCents += price
        }
      }
    }

    return {
      totalBooths,
      assignedBooths,
      paidBooths,
      vipHoldBooths,
      unassignedBooths: totalBooths - assignedBooths,
      collectedRevenueCents,
      pendingRevenueCents,
      squareConnected,
      stripeConnected,
    }
  }, [
    appByVendorId,
    boothPriceByApplicationId,
    docRevision,
    floorPlanStore,
    squareConnected,
    stripeConnected,
    vipHoldIds,
  ])

  const setLayoutRooms = useCallback((rooms: LayoutRoom[], activeRoomId: string) => {
    setLayoutRoomsState(rooms)
    setLayoutActiveRoomId(activeRoomId)
  }, [])

  const toggleVipHold = useCallback((applicationId: string) => {
    setVipHoldIds((prev) => {
      const next = new Set(prev)
      if (next.has(applicationId)) next.delete(applicationId)
      else next.add(applicationId)
      return next
    })
  }, [])

  const assignVendorToBooth = useCallback(
    (boothId: string, application: VendorApplicationSnapshot) => {
      if (!floorPlanStore) return
      const vendorName = application.vendorName ?? 'Vendor'
      floorPlanStore.updateObject(
        boothId,
        {
          vendorId: application.vendor_id,
          label: vendorName,
          categoryName: application.categoryName ?? null,
        } as Partial<BoothObject>,
        { pushHistory: true }
      )
      setSelectedBoothId(boothId)
      setDocRevision((n) => n + 1)
    },
    [floorPlanStore]
  )

  const unassignBooth = useCallback(
    (boothId: string) => {
      if (!floorPlanStore) return
      floorPlanStore.updateObject(
        boothId,
        { vendorId: null, label: undefined } as Partial<BoothObject>,
        { pushHistory: true }
      )
      setDocRevision((n) => n + 1)
    },
    [floorPlanStore]
  )

  const assignVendorToBoothByVendorId = useCallback(
    (boothId: string, vendorId: string | null) => {
      if (!vendorId) {
        unassignBooth(boothId)
        return
      }
      const application = approvedPool.find(
        (app) => app.vendor_id === vendorId
      )
      if (!application) return
      assignVendorToBooth(boothId, application)
    },
    [assignVendorToBooth, approvedPool, unassignBooth]
  )

  const autoSeatApprovedVendors = useCallback((): number => {
    if (!floorPlanStore) return 0
    const booths = floorPlanStore.doc.objects.filter(
      (o): o is BoothObject => o.kind === 'booth'
    )
    const openBooths = booths
      .filter((b) => !b.vendorId)
      .sort((a, b) => a.y - b.y || a.x - b.x)
    const unplaced = approvedVendorsNotOnCanvas(approvedPool, booths)
    let seated = 0
    const remainingOpen = [...openBooths]

    for (const app of unplaced) {
      const booth = pickBoothForApplication(remainingOpen, app)
      if (!booth) break
      const vendorName = app.vendorName ?? 'Vendor'
      floorPlanStore.updateObject(
        booth.id,
        {
          vendorId: app.vendor_id,
          label: vendorName,
          categoryName: app.categoryName ?? null,
        } as Partial<BoothObject>,
        { pushHistory: true }
      )
      const idx = remainingOpen.findIndex((b) => b.id === booth.id)
      if (idx >= 0) remainingOpen.splice(idx, 1)
      seated += 1
    }

    if (seated > 0) {
      setDocRevision((n) => n + 1)
    }
    return seated
  }, [approvedPool, floorPlanStore])

  const focusBooth = useCallback(
    (boothId: string) => {
      setSelectedBoothId(boothId)
      floorPlanStore?.setSelection(new Set([boothId]))
    },
    [floorPlanStore]
  )

  const hasClearanceIssues = useMemo(() => {
    if (hubGridLayoutMode === 'simple') return false
    void docRevision
    if (!floorPlanStore) return false
    return docHasUnresolvedClearanceIssues(floorPlanStore.doc)
  }, [docRevision, floorPlanStore, hubGridLayoutMode])

  const canvasVendorBoothCount = useMemo(() => {
    void docRevision
    if (!floorPlanStore) return 0
    return floorPlanStore.doc.objects.filter(
      (o): o is BoothObject => o.kind === 'booth' && !isGuestTableBooth(o)
    ).length
  }, [docRevision, floorPlanStore])

  const eventCategoryNames = useMemo(() => {
    if (!selectedEventId) return []
    const fromLimits = eventCategoryNamesByEventId[selectedEventId] ?? []
    if (fromLimits.length > 0) return fromLimits
    return [
      ...new Set(
        approvedPool
          .map((app) => app.categoryName)
          .filter((name): name is string => Boolean(name?.trim()))
      ),
    ].sort()
  }, [approvedPool, eventCategoryNamesByEventId, selectedEventId])

  const value = useMemo(
    (): MarketManagementState => ({
      events: eventsState,
      selectedEventId,
      setSelectedEventId,
      pendingApplications,
      approvedPool,
      layoutRooms,
      layoutActiveRoomId,
      setLayoutRooms,
      floorPlanStore,
      registerFloorPlanStore,
      selectedBoothId,
      setSelectedBoothId,
      boothStatusByObjectId,
      telemetry,
      vipHoldApplicationIds: vipHoldIds,
      toggleVipHold,
      assignVendorToBooth,
      assignVendorToBoothByVendorId,
      unassignBooth,
      autoSeatApprovedVendors,
      refreshApprovedPool,
      registerFloorPlanLayoutActions,
      populateTestSuiteOnCanvas,
      focusBooth,
      totalRevenueCents,
      hasClearanceIssues,
      hubGridLayoutMode,
      setHubGridLayoutMode,
      canvasVendorBoothCount,
      eventCategoryNames,
      patchEventListingMode,
    }),
    [
      eventsState,
      selectedEventId,
      setSelectedEventId,
      pendingApplications,
      approvedPool,
      layoutRooms,
      layoutActiveRoomId,
      setLayoutRooms,
      floorPlanStore,
      registerFloorPlanStore,
      selectedBoothId,
      boothStatusByObjectId,
      telemetry,
      vipHoldIds,
      toggleVipHold,
      assignVendorToBooth,
      assignVendorToBoothByVendorId,
      unassignBooth,
      autoSeatApprovedVendors,
      refreshApprovedPool,
      registerFloorPlanLayoutActions,
      populateTestSuiteOnCanvas,
      focusBooth,
      totalRevenueCents,
      hasClearanceIssues,
      hubGridLayoutMode,
      setHubGridLayoutMode,
      canvasVendorBoothCount,
      eventCategoryNames,
      patchEventListingMode,
    ]
  )

  return (
    <MarketManagementContext.Provider value={value}>{children}</MarketManagementContext.Provider>
  )
}

export { formatCadCurrency } from '@/lib/coordinator/booth-placement-status'
