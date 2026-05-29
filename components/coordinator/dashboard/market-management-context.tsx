'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { LayoutRoom } from '@/types/database'
import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import {
  deriveBoothPlacementStatus,
  type BoothPlacementStatus,
  type VendorApplicationSnapshot,
} from './booth-placement-status'
import { formatCadCurrency } from '@/lib/coordinator/booth-placement-status'

export interface DashboardEventSummary {
  id: string
  name: string
  start_at: string
  status: string
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
  unassignBooth: (boothId: string) => void
  focusBooth: (boothId: string) => void
  totalRevenueCents: number
}

const MarketManagementContext = createContext<MarketManagementState | null>(null)

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
  squareConnected: boolean
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
  squareConnected,
  totalRevenueCents,
}: MarketManagementProviderProps) {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId ?? events[0]?.id ?? null)

  const initialLayout = selectedEventId ? layoutsByEventId[selectedEventId] : undefined
  const [layoutRooms, setLayoutRoomsState] = useState<LayoutRoom[]>(
    initialLayout?.rooms ?? []
  )
  const [layoutActiveRoomId, setLayoutActiveRoomId] = useState(
    initialLayout?.activeRoomId ?? ''
  )
  const [floorPlanStore, setFloorPlanStore] = useState<FloorPlanDocStore | null>(null)
  const [selectedBoothId, setSelectedBoothId] = useState<string | null>(null)
  const [vipHoldIds, setVipHoldIds] = useState<Set<string>>(() => new Set())
  const [docRevision, setDocRevision] = useState(0)

  useEffect(() => {
    if (!selectedEventId) return
    const bundle = layoutsByEventId[selectedEventId]
    if (!bundle) return
    setLayoutRoomsState(bundle.rooms)
    setLayoutActiveRoomId(bundle.activeRoomId)
    setSelectedBoothId(null)
    setFloorPlanStore(null)
  }, [layoutsByEventId, selectedEventId])

  const approvedPool = useMemo(
    () => (selectedEventId ? approvedByEventId[selectedEventId] ?? [] : []),
    [approvedByEventId, selectedEventId]
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

  const registerFloorPlanStore = useCallback((store: FloorPlanDocStore | null) => {
    setFloorPlanStore(store)
  }, [])

  useEffect(() => {
    if (!floorPlanStore) return
    setDocRevision((n) => n + 1)
  }, [floorPlanStore?.doc.objects, floorPlanStore?.selectedIds])

  const boothStatusByObjectId = useMemo(() => {
    void docRevision
    const map = new Map<string, BoothPlacementStatus>()
    if (!floorPlanStore) return map
    for (const obj of floorPlanStore.doc.objects) {
      if (obj.kind !== 'booth') continue
      map.set(
        obj.id,
        deriveBoothPlacementStatus(obj as BoothObject, appByVendorId, vipHoldIds)
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
        totalBooths += 1
        const booth = obj as BoothObject
        if (!booth.vendorId) continue
        assignedBooths += 1
        const status = deriveBoothPlacementStatus(booth, appByVendorId, vipHoldIds)
        const app = appByVendorId.get(booth.vendorId)
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
    }
  }, [
    appByVendorId,
    boothPriceByApplicationId,
    docRevision,
    floorPlanStore,
    squareConnected,
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

  const focusBooth = useCallback(
    (boothId: string) => {
      setSelectedBoothId(boothId)
      floorPlanStore?.setSelection(new Set([boothId]))
    },
    [floorPlanStore]
  )

  const value = useMemo(
    (): MarketManagementState => ({
      events,
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
      unassignBooth,
      focusBooth,
      totalRevenueCents,
    }),
    [
      events,
      selectedEventId,
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
      unassignBooth,
      focusBooth,
      totalRevenueCents,
    ]
  )

  return (
    <MarketManagementContext.Provider value={value}>{children}</MarketManagementContext.Provider>
  )
}

export { formatCadCurrency } from '@/lib/coordinator/booth-placement-status'
