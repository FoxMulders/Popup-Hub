/** Canvas fill/arrange hooks registered by FloorPlanV2 for Command center QA flows. */
export interface FloorPlanLayoutActions {
  fillVendorTables: (count: number) => void
  autoArrangeFloorPlan: () => void | Promise<void>
  estimateVendorFillCapacity: () => number
}
