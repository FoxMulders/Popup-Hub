import type { BoothCell, VenueElement } from '@/types/database'
import {
  type LayoutPreset,
  isClusterPlacement,
  isIndoorCorridorPlacement,
  isPerimeterPlacement,
  constrainedOriginsForBooth,
  genericRowLayoutModeFromPreset,
} from '@/lib/booth-planner/layout-presets'
import {
  AUTO_PLAN_CAPACITY_TOAST,
  buildAccessiblePlacementSlots,
  buildWalkwayCells,
  boothHasAisleFrontage,
  canPlaceAccessible,
  type PlacementContext,
} from '@/lib/booth-planner/accessible-placement'
import { blockedCellKeys, buildDefaultVenueElements, cellKey } from '@/lib/booth-planner/venue-elements'
import { validateAutoLayoutPlacement } from '@/lib/booth-planner/layout-validation'
import {
  buildEntranceExitOnlyElements,
  canPlaceCoGeneratedUnit,
  venueShellForCoPlan,
} from '@/lib/booth-planner/co-generated-aisles'
import { categoryIsolationScore, normalizeCategoryKey } from '@/lib/booth-planner/category-isolation'
import { VendorPlacementGuard } from '@/lib/booth-planner/vendor-placement-guards'
import {
  alignOriginToPerimeterWall,
  boothStorefrontFacesPerimeterConcourse,
  perimeterPlacementAtOrigin,
  resolveBoothSpansAtOrigin,
} from '@/lib/booth-planner/perimeter-orientation'
import { BOOTH_CORE_SEPARATION_CELLS } from '@/lib/booth-planner/layout-clearance-constants'
import { gridSpansForTableOrientation, type TableOrientation } from '@/lib/booth-planner/table-orientation'
import { detectLayoutOverlaps } from '@/lib/booth-planner/layout-overlap'
import {
  AUTO_PLAN_CAPACITY_LIMIT_MESSAGE,
  PlacementIterationBudget,
} from '@/lib/booth-planner/placement-guard'
import { isTentVendor, type VendorUnitType } from '@/lib/booth-planner/vendor-unit-types'
import {
  buildBlockedWallKeys,
  resolveBoothSpansForWalkway,
  sightlineAlignmentScore,
  storefrontSideFacesWall,
  storefrontSideForOrientation,
  tableLongAxisParallelToFlowScore,
  type StorefrontSide,
} from '@/lib/booth-planner/aisle-orientation'
import { indoorCorridorFlowVectorAt, computeInteriorBounds } from '@/lib/booth-planner/indoor-corridor-layout'
import {
  computePatronPathTrace,
  patronPathFlowVectorAt,
  type PatronPathTrace,
} from '@/lib/booth-planner/patron-path-trace'
import {
  sharedAisleOrientationBonus,
} from '@/lib/booth-planner/shared-aisle'
import { findVenueAnchors } from '@/lib/booth-planner/venue-anchors'
import { mergeSafetyBlockedKeys } from '@/lib/booth-planner/placement-safety-zones'
import { placementViolatesStrollerSeparation } from '@/lib/booth-planner/stroller-clearance'
import {
  collectPowerRoutingTargets,
  powerRoutingScore,
  requiresPowerVendor,
} from '@/lib/booth-planner/power-routing'
import { isLShapeCornersPlacement } from '@/lib/booth-planner/l-shape-corners-layout'
import { facingTargetForStorefrontSide } from '@/lib/booth-planner/facing-target'
import {
  genericRowFlowVectorAt,
  genericRowStorefrontBonus,
  isGenericRowPlacement,
  type GenericRowLayoutMode,
} from '@/lib/booth-planner/generic-row-layouts'
import {
  isModifiedLoopPlacement,
  scoreRightHandBias,
  scoreSightlineHierarchy,
  sortModifiedLoopVendorQueue,
  type VendorTier,
} from '@/lib/booth-planner/modified-loop-layout'

interface VendorInput {
  id: string
  vendorName: string
  categoryName: string
  categoryId?: string | null
  categoryColor: string
  colSpan: number
  rowSpan: number
  vendorUnitType?: VendorUnitType
  tableLengthFt?: number | null
  tableOrientation?: TableOrientation | null
  requestedBoothType?: 'inside' | 'wall' | 'power' | 'any' | null
  tier?: VendorTier
}

export interface AutoLayoutParams {
  venueWidth: number
  venueLength: number
  boothWidth: number
  boothLength: number
  entrance: 'north' | 'south' | 'east' | 'west'
  venueElements: VenueElement[]
  vendors: VendorInput[]
  preset?: LayoutPreset
  /** Indoor hall corridor grammar (outdoor preset + perimeter walls). */
  useIndoorCorridor?: boolean
  /** When true, place vendors in array order (FCFS) instead of grouping by category. */
  fcfsOrder?: boolean
  /** Pair each booth with an 8′ co-generated aisle block (1′ grid / market units). */
  coGenerateAisles?: boolean
}

export interface AutoLayoutResult {
  cells: BoothCell[]
  placedCount: number
  unplacedCount: number
  /** True when placement stopped early because the room hit safe capacity. */
  capacityReached: boolean
  capacityMessage: string | null
  /** Aisle blocks paired with booths during co-generated auto-plan. */
  coGeneratedAisleElements: VenueElement[]
  /** Full fixture set after co-plan (entrance/exit + interior + paired aisles). */
  venueElements: VenueElement[]
  /** True when the iteration budget circuit-breaker halted placement. */
  iterationLimitHit?: boolean
  /** Cells with overlap conflicts detected before completion. */
  overlapKeys?: Set<string>
  /** True when placement stopped early due to overlap detection. */
  stoppedOnOverlap?: boolean
}

type CellState = 'empty' | 'blocked' | 'occupied'

export interface AutoLayoutSessionOptions {
  /** Stop and surface overlap keys as soon as a collision is detected. */
  stopOnOverlap?: boolean
}

export class AutoLayoutSession {
  readonly cols: number
  readonly rows: number
  readonly fixtures: VenueElement[]
  readonly blocked: Set<string>
  /** Stair landings + exit cones — booth core may not occupy these cells. */
  readonly placementForbidden: Set<string>
  readonly walkway: Set<string>
  readonly coGeneratedAisleElements: VenueElement[] = []
  readonly grid: CellState[][]
  readonly placementOrderFlat: Int32Array
  readonly perimeterOriginsCache = new Map<number, Int32Array>()
  readonly usePerimeterOnly: boolean
  readonly useOutdoorClusters: boolean
  readonly useIndoorCorridor: boolean
  readonly genericRowMode: GenericRowLayoutMode | null
  readonly coGenerateAisles: boolean
  readonly useModifiedLoop: boolean
  readonly entrance: AutoLayoutParams['entrance']
  readonly boothWidth: number
  readonly boothLength: number
  readonly wallKeys: Set<string>
  readonly venueAnchors: ReturnType<typeof findVenueAnchors>
  readonly layoutPreset: LayoutPreset
  readonly patronPathTrace: PatronPathTrace | null
  readonly powerRoutingTargets: Set<string>

  private readonly vendorQueue: VendorInput[]
  private readonly stopOnOverlap: boolean
  private readonly categoryGuard: VendorPlacementGuard

  private vendorIndex = 0
  private boothNumber = 1
  private boothRects: { r0: number; c0: number; r1: number; c1: number }[] = []
  private cells: BoothCell[] = []
  private capacityReached = false
  private iterationLimitHit = false
  private stoppedOnOverlap = false
  private overlapKeys = new Set<string>()
  private done = false
  private sanitized = false

  constructor(params: AutoLayoutParams, options: AutoLayoutSessionOptions = {}) {
    const {
      venueWidth,
      venueLength,
      boothWidth,
      boothLength,
      entrance,
      venueElements,
      vendors,
      preset = 'default',
      fcfsOrder = false,
      coGenerateAisles = false,
      useIndoorCorridor = false,
    } = params

    this.entrance = entrance
    this.boothWidth = boothWidth
    this.boothLength = boothLength
    this.coGenerateAisles = coGenerateAisles
    this.useModifiedLoop = preset === 'modified_loop'
    this.genericRowMode = genericRowLayoutModeFromPreset(preset)
    this.useIndoorCorridor = useIndoorCorridor || this.genericRowMode === 'snake' || this.useModifiedLoop
    this.layoutPreset = preset
    this.usePerimeterOnly = preset === 'perimeter'
    this.useOutdoorClusters =
      preset === 'outdoor' ||
      preset === 'aligned_grid' ||
      preset === 'l_shape_corners' ||
      preset === 'modified_loop' ||
      useIndoorCorridor ||
      this.genericRowMode != null
    this.stopOnOverlap = options.stopOnOverlap ?? false

    this.cols = Math.max(1, Math.floor(venueWidth / boothWidth))
    this.rows = Math.max(1, Math.floor(venueLength / boothLength))

    const useCoPlanShell = coGenerateAisles && preset !== 'outdoor'
    this.fixtures = useCoPlanShell
      ? venueShellForCoPlan(
          venueElements.length > 0 ? venueElements : buildEntranceExitOnlyElements(entrance, this.cols, this.rows),
          entrance,
          this.cols,
          this.rows
        )
      : venueElements.length > 0
        ? venueElements
        : buildDefaultVenueElements(entrance, this.cols, this.rows)

    this.blocked = blockedCellKeys(this.fixtures)
    this.placementForbidden = mergeSafetyBlockedKeys(
      new Set(this.blocked),
      this.fixtures,
      this.cols,
      this.rows
    )
    this.powerRoutingTargets = collectPowerRoutingTargets(this.fixtures, this.cols, this.rows)
    this.walkway = buildWalkwayCells(this.fixtures)
    this.wallKeys = buildBlockedWallKeys(this.fixtures, this.cols, this.rows)
    this.venueAnchors = findVenueAnchors(this.fixtures)
    this.patronPathTrace =
      this.useIndoorCorridor || this.genericRowMode === 'snake' || this.useModifiedLoop
        ? computePatronPathTrace(this.fixtures, this.cols, this.rows, entrance)
        : null

    this.grid = Array.from({ length: this.rows }, () => Array<CellState>(this.cols).fill('empty'))
    for (const key of this.blocked) {
      const [r, c] = key.split('-').map(Number)
      if (r >= 0 && r < this.rows && c >= 0 && c < this.cols) {
        this.grid[r][c] = 'blocked'
      }
    }

    const placementOrder = buildPlacementOrder(this.rows, this.cols, entrance)
    this.placementOrderFlat = flattenPlacementOrder(placementOrder)
    this.categoryGuard = new VendorPlacementGuard(this.cols, this.rows)
    this.vendorQueue = flattenVendorQueue(vendors, fcfsOrder, preset)
  }

  private rejectsCategoryIsolation(
    categoryKey: string,
    row: number,
    col: number,
    rowSpan: number,
    colSpan: number
  ): boolean {
    return this.categoryGuard.rejectsAutoPlacement({
      categoryKey,
      row,
      col,
      rowSpan,
      colSpan,
    })
  }

  get isDone(): boolean {
    return this.done
  }

  get hasIterationLimitHit(): boolean {
    return this.iterationLimitHit
  }

  get hasStoppedOnOverlap(): boolean {
    return this.stoppedOnOverlap
  }

  /** Patron path trace when available; otherwise serpentine cluster order. */
  private flowVectorAt(row: number, col: number): { dr: number; dc: number } | null {
    if (this.patronPathTrace) {
      const pathFlow = patronPathFlowVectorAt(row, col, this.patronPathTrace)
      if (pathFlow) return pathFlow
    }
    if (this.genericRowMode) {
      return genericRowFlowVectorAt(
        this.genericRowMode,
        this.cols,
        this.rows,
        this.entrance,
        row,
        col
      )
    }
    if (this.useIndoorCorridor) {
      return indoorCorridorFlowVectorAt(this.cols, this.rows, this.entrance, row, col)
    }
    return null
  }

  private flowAlignmentBonus(
    row: number,
    col: number,
    colSpan: number,
    rowSpan: number,
    storefront: StorefrontSide
  ): number {
    const flow = this.flowVectorAt(row, col)
    return (
      sightlineAlignmentScore(storefront, flow) * 200 +
      tableLongAxisParallelToFlowScore(colSpan, rowSpan, flow) * 150
    )
  }

  tick(maxVendors = Infinity): void {
    if (this.done) return

    let placedThisTick = 0
    while (this.vendorIndex < this.vendorQueue.length && placedThisTick < maxVendors) {
      const vendor = this.vendorQueue[this.vendorIndex]
      this.vendorIndex += 1
      placedThisTick += 1

      const spot = this.findAccessiblePlacement(vendor)
      if (spot) {
        if (
          this.usePerimeterOnly &&
          !isPerimeterPlacement(spot.row, spot.col, spot.rowSpan, spot.colSpan, this.rows, this.cols)
        ) {
          this.cells.push(this.unplacedCell(vendor))
          continue
        }
        if (
          this.genericRowMode &&
          !isGenericRowPlacement(
            this.genericRowMode,
            spot.row,
            spot.col,
            spot.rowSpan,
            spot.colSpan,
            this.rows,
            this.cols
          )
        ) {
          this.cells.push(this.unplacedCell(vendor))
          continue
        }
        if (
          this.useModifiedLoop &&
          !isModifiedLoopPlacement(
            spot.row,
            spot.col,
            spot.rowSpan,
            spot.colSpan,
            this.cols,
            this.rows,
            this.entrance,
            this.fixtures
          )
        ) {
          this.cells.push(this.unplacedCell(vendor))
          continue
        }
        if (
          this.useIndoorCorridor &&
          !this.genericRowMode &&
          !this.useModifiedLoop &&
          !isIndoorCorridorPlacement(spot.row, spot.col, spot.rowSpan, spot.colSpan, this.rows, this.cols)
        ) {
          this.cells.push(this.unplacedCell(vendor))
          continue
        }
        if (
          this.useOutdoorClusters &&
          !this.useIndoorCorridor &&
          !this.genericRowMode &&
          !isClusterPlacement(spot.row, spot.col, spot.rowSpan, spot.colSpan, this.rows, this.cols)
        ) {
          this.cells.push(this.unplacedCell(vendor))
          continue
        }
        this.placeAt(
          vendor,
          spot.row,
          spot.col,
          spot.colSpan,
          spot.rowSpan,
          spot.tableOrientation,
          spot.storefront
        )
        if (this.stopOnOverlap && this.captureOverlapIfAny()) {
          return
        }
      } else {
        this.cells.push(this.unplacedCell(vendor))
      }
    }

    if (this.vendorIndex >= this.vendorQueue.length) {
      this.finish()
    }
  }

  runToCompletion(): AutoLayoutResult {
    while (!this.done) {
      this.tick(Number.POSITIVE_INFINITY)
    }
    return this.getResult()
  }

  getResult(): AutoLayoutResult {
    if (!this.sanitized) {
      this.sanitizePlacements()
    }

    const placedCount = this.cells.filter((c) => c.col >= 0).length
    const unplacedCount = this.cells.length - placedCount
    const capacityReached = unplacedCount > 0 || this.capacityReached

    let capacityMessage: string | null = null
    if (this.iterationLimitHit) {
      capacityMessage = AUTO_PLAN_CAPACITY_LIMIT_MESSAGE
    } else if (capacityReached) {
      capacityMessage = AUTO_PLAN_CAPACITY_TOAST
    }

    return {
      cells: this.cells,
      placedCount,
      unplacedCount,
      capacityReached,
      capacityMessage,
      coGeneratedAisleElements: this.coGeneratedAisleElements,
      venueElements: this.fixtures,
      iterationLimitHit: this.iterationLimitHit,
      overlapKeys: this.overlapKeys.size > 0 ? new Set(this.overlapKeys) : undefined,
      stoppedOnOverlap: this.stoppedOnOverlap,
    }
  }

  private usesStructuredRowGrammar(): boolean {
    return this.useIndoorCorridor || this.genericRowMode != null
  }

  private placementContext(strictStorefront?: StorefrontSide): PlacementContext {
    const structured = this.usesStructuredRowGrammar()
    const paintedAislePreset =
      structured || this.useOutdoorClusters || this.usePerimeterOnly || this.useIndoorCorridor
    return {
      rows: this.rows,
      cols: this.cols,
      grid: this.grid,
      walkway: this.walkway,
      boothRects: this.boothRects,
      boothWidthFt: this.boothWidth,
      boothLengthFt: this.boothLength,
      wallKeys: this.wallKeys,
      strictStorefront: structured ? undefined : strictStorefront,
      requireClearanceRing: !paintedAislePreset,
      skipStrollerSeparation: paintedAislePreset,
      skipClusterLimit: structured || this.usePerimeterOnly,
      perimeterConcourseFrontage: this.usePerimeterOnly,
      placementForbidden: this.placementForbidden,
    }
  }

  private markOccupied(startRow: number, startCol: number, rowSpan: number, colSpan: number) {
    this.boothRects.push({
      r0: startRow,
      c0: startCol,
      r1: startRow + rowSpan - 1,
      c1: startCol + colSpan - 1,
    })
    for (let r = startRow; r < startRow + rowSpan; r++) {
      for (let c = startCol; c < startCol + colSpan; c++) {
        this.grid[r][c] = 'occupied'
      }
    }
  }

  private defaultStorefrontForPlacement(
    row: number,
    col: number,
    colSpan: number,
    rowSpan: number,
    tableOrientation?: TableOrientation | null
  ): StorefrontSide {
    if (tableOrientation) {
      return storefrontSideForOrientation(colSpan, rowSpan, tableOrientation)
    }
    return storefrontSideForOrientation(colSpan, rowSpan, colSpan >= rowSpan ? 'horizontal' : 'vertical')
  }

  private placeAt(
    vendor: VendorInput,
    row: number,
    col: number,
    colSpan: number,
    rowSpan: number,
    tableOrientation?: TableOrientation,
    storefront?: StorefrontSide
  ): void {
    this.markOccupied(row, col, rowSpan, colSpan)

    const resolvedStorefront =
      storefront ??
      this.defaultStorefrontForPlacement(
        row,
        col,
        colSpan,
        rowSpan,
        tableOrientation ?? vendor.tableOrientation
      )

    this.cells.push({
      id: vendor.id,
      col,
      row,
      colSpan,
      rowSpan,
      vendorName: vendor.vendorName,
      categoryName: vendor.categoryName,
      categoryColor: vendor.categoryColor,
      boothNumber: this.boothNumber++,
      vendorUnitType: vendor.vendorUnitType ?? 'table',
      tableLengthFt: vendor.tableLengthFt ?? null,
      tableOrientation: tableOrientation ?? vendor.tableOrientation ?? null,
      facingTarget: facingTargetForStorefrontSide(resolvedStorefront),
    })

    const categoryKey = normalizeCategoryKey(vendor.categoryName, vendor.categoryId)
    this.categoryGuard.markPlaced(
      {
        id: vendor.id,
        row,
        col,
        rowSpan,
        colSpan,
        categoryName: vendor.categoryName,
      } as BoothCell,
      categoryKey
    )
  }

  private unplacedCell(vendor: VendorInput): BoothCell {
    return {
      id: vendor.id,
      col: -1,
      row: -1,
      colSpan: vendor.colSpan,
      rowSpan: vendor.rowSpan,
      vendorName: vendor.vendorName,
      categoryName: vendor.categoryName,
      categoryColor: vendor.categoryColor,
      boothNumber: -1,
      vendorUnitType: vendor.vendorUnitType ?? 'table',
      tableLengthFt: vendor.tableLengthFt ?? null,
      tableOrientation: vendor.tableOrientation ?? null,
    }
  }

  private resolveTableSpans(
    vendor: VendorInput,
    row: number,
    col: number
  ): {
    colSpan: number
    rowSpan: number
    orientation?: TableOrientation
    storefront?: StorefrontSide
  } {
    if (isTentVendor(vendor.vendorUnitType)) {
      return { colSpan: vendor.colSpan, rowSpan: vendor.rowSpan }
    }
    if (
      this.useOutdoorClusters &&
      !this.useIndoorCorridor &&
      !this.genericRowMode
    ) {
      return {
        colSpan: vendor.colSpan,
        rowSpan: vendor.rowSpan,
        orientation: vendor.tableOrientation ?? 'horizontal',
      }
    }
    const tableFt = vendor.tableLengthFt ?? 6
    if (vendor.tableOrientation) {
      const spacingMode = this.coGenerateAisles ? 'one_foot' : 'table_provided'
      const spans = gridSpansForTableOrientation(tableFt, spacingMode, vendor.tableOrientation)
      return { ...spans, orientation: vendor.tableOrientation }
    }

    if (this.useOutdoorClusters || this.useIndoorCorridor) {
      const gridOccupied = (r: number, c: number) => this.grid[r][c] !== 'empty'
      const oriented = resolveBoothSpansForWalkway(
        row,
        col,
        tableFt,
        this.rows,
        this.cols,
        this.walkway,
        this.wallKeys,
        gridOccupied,
        (storefront, colSpan, rowSpan) =>
          this.flowAlignmentBonus(row, col, colSpan, rowSpan, storefront)
      )
      if (oriented) {
        return {
          colSpan: oriented.colSpan,
          rowSpan: oriented.rowSpan,
          orientation: oriented.orientation,
          storefront: oriented.storefront,
        }
      }
    }

    if (this.usePerimeterOnly) {
      const placed = perimeterPlacementAtOrigin(row, col, tableFt, this.rows, this.cols)
      if (placed) {
        return {
          colSpan: placed.colSpan,
          rowSpan: placed.rowSpan,
          orientation: placed.orientation,
          storefront: placed.storefront,
        }
      }
    }

    return resolveBoothSpansAtOrigin(row, col, tableFt, this.rows, this.cols)
  }

  private constrainedOriginsFlat(rowSpan: number, colSpan: number, preset: LayoutPreset): Int32Array {
    const modeOffset =
      this.useModifiedLoop
        ? 7_000_000
        : this.genericRowMode === 'vertical_rows'
          ? 4_000_000
          : this.genericRowMode === 'horizontal_rows'
            ? 5_000_000
            : this.genericRowMode === 'snake'
              ? 6_000_000
              : this.useIndoorCorridor
                ? 3_000_000
                : preset === 'outdoor'
                  ? 2_000_000
                  : 1_000_000
    const key = modeOffset + rowSpan * 1000 + colSpan
    const cached = this.perimeterOriginsCache.get(key)
    if (cached) return cached

    const origins = constrainedOriginsForBooth(
      preset,
      this.rows,
      this.cols,
      this.entrance,
      rowSpan,
      colSpan,
      'street-fair',
      this.useIndoorCorridor,
      this.fixtures
    )
    const flat = flattenPlacementOrder(origins)
    this.perimeterOriginsCache.set(key, flat)
    return flat
  }

  private constrainedOriginsForVendor(vendor: VendorInput): Int32Array {
    if (!this.useOutdoorClusters) {
      if (this.usePerimeterOnly) {
        return this.constrainedOriginsFlat(vendor.rowSpan, vendor.colSpan, 'perimeter')
      }
      return this.placementOrderFlat
    }

    const tent = isTentVendor(vendor.vendorUnitType)
    const spanPairs: [number, number][] = [[vendor.rowSpan, vendor.colSpan]]
    if (!tent) {
      spanPairs.push([vendor.colSpan, vendor.rowSpan])
    }

    const merged: number[] = []
    const seen = new Set<string>()
    for (const [rowSpan, colSpan] of spanPairs) {
      const flat = this.constrainedOriginsFlat(rowSpan, colSpan, this.layoutPreset)
      for (let i = 0; i < flat.length; i += 2) {
        const key = `${flat[i]}-${flat[i + 1]}`
        if (seen.has(key)) continue
        seen.add(key)
        merged.push(flat[i], flat[i + 1])
      }
    }
    return Int32Array.from(merged)
  }

  private orientationCandidatesForVendor(vendor: VendorInput): {
    colSpan: number
    rowSpan: number
    orientation: TableOrientation
    storefront: StorefrontSide
  }[] {
    if (isTentVendor(vendor.vendorUnitType)) {
      return [
        {
          colSpan: vendor.colSpan,
          rowSpan: vendor.rowSpan,
          orientation: vendor.tableOrientation ?? 'horizontal',
          storefront: storefrontSideForOrientation(
            vendor.colSpan,
            vendor.rowSpan,
            vendor.tableOrientation ?? 'horizontal'
          ),
        },
      ]
    }

    const tableFt = vendor.tableLengthFt ?? 6
    const spacingMode = this.coGenerateAisles ? 'one_foot' : 'table_provided'

    if (vendor.tableOrientation) {
      const spans = gridSpansForTableOrientation(tableFt, spacingMode, vendor.tableOrientation)
      return [
        {
          ...spans,
          orientation: vendor.tableOrientation,
          storefront: storefrontSideForOrientation(spans.colSpan, spans.rowSpan, vendor.tableOrientation),
        },
      ]
    }

    if (this.genericRowMode === 'vertical_rows') {
      const vertical = gridSpansForTableOrientation(tableFt, 'one_foot', 'vertical')
      return [
        { ...vertical, orientation: 'vertical' as const, storefront: 'right' as const },
        { ...vertical, orientation: 'vertical' as const, storefront: 'left' as const },
      ]
    }

    if (this.genericRowMode === 'horizontal_rows') {
      const horizontal = gridSpansForTableOrientation(tableFt, 'one_foot', 'horizontal')
      return [
        { ...horizontal, orientation: 'horizontal' as const, storefront: 'bottom' as const },
        { ...horizontal, orientation: 'horizontal' as const, storefront: 'top' as const },
      ]
    }

    if (this.useIndoorCorridor || this.genericRowMode === 'snake') {
      const horizontal = gridSpansForTableOrientation(tableFt, 'one_foot', 'horizontal')
      const vertical = gridSpansForTableOrientation(tableFt, 'one_foot', 'vertical')
      return [
        { ...horizontal, orientation: 'horizontal' as const, storefront: 'bottom' as const },
        { ...horizontal, orientation: 'horizontal' as const, storefront: 'top' as const },
        { ...vertical, orientation: 'vertical' as const, storefront: 'right' as const },
        { ...vertical, orientation: 'vertical' as const, storefront: 'left' as const },
      ]
    }

    if (this.useOutdoorClusters) {
      return (['horizontal', 'vertical'] as const).map((orientation) => {
        const spans = gridSpansForTableOrientation(tableFt, 'one_foot', orientation)
        return {
          ...spans,
          orientation,
          storefront: storefrontSideForOrientation(spans.colSpan, spans.rowSpan, orientation),
        }
      })
    }

    if (this.usePerimeterOnly) {
      const placed = perimeterPlacementAtOrigin(0, 0, tableFt, this.rows, this.cols)
      if (placed) return [placed]
    }

    return [
      {
        ...resolveBoothSpansAtOrigin(0, 0, tableFt, this.rows, this.cols),
        orientation: 'horizontal' as const,
        storefront: 'bottom' as const,
      },
    ]
  }

  private findAccessiblePlacement(
    vendor: VendorInput
  ): {
    row: number
    col: number
    colSpan: number
    rowSpan: number
    tableOrientation?: TableOrientation
    storefront?: StorefrontSide
  } | null {
    const categoryKey = normalizeCategoryKey(vendor.categoryName, vendor.categoryId)
    const tent = isTentVendor(vendor.vendorUnitType)

    const originsFlat = this.constrainedOriginsForVendor(vendor)
    const searchBudget =
      this.useIndoorCorridor ||
      this.genericRowMode != null ||
      (this.useOutdoorClusters && !this.useIndoorCorridor)
        ? undefined
        : new PlacementIterationBudget()

    if (this.coGenerateAisles && !tent && !this.useOutdoorClusters) {
      let bestCo: {
        row: number
        col: number
        colSpan: number
        rowSpan: number
        tableOrientation?: TableOrientation
        storefront?: StorefrontSide
      } | null = null
      let bestScore = -Infinity

      for (let i = 0; i < originsFlat.length; i += 2) {
        const row = originsFlat[i]
        const col = originsFlat[i + 1]
        const resolved = this.resolveTableSpans(vendor, row, col)
        const { colSpan, rowSpan, orientation, storefront: baselineStorefront } = resolved
        const ctx = this.placementContext()
        if (!canPlaceCoGeneratedUnit(ctx, row, col, rowSpan, colSpan)) {
          continue
        }
        if (this.rejectsCategoryIsolation(categoryKey, row, col, rowSpan, colSpan)) {
          continue
        }
        const score = categoryIsolationScore(row, col, rowSpan, colSpan, {
          categoryKey,
          index: this.categoryGuard.categoryIndex,
        })
        if (score > bestScore) {
          bestScore = score
          bestCo = {
            row,
            col,
            colSpan,
            rowSpan,
            tableOrientation: orientation,
            storefront: baselineStorefront,
          }
        }
      }
      if (bestCo) return bestCo
    }

    const tryPhases =
      this.usePerimeterOnly || (this.useOutdoorClusters && !this.useIndoorCorridor && !this.genericRowMode)
        ? [true]
        : this.useIndoorCorridor || this.genericRowMode != null
          ? [false]
          : [true, false]

    for (let phase = 0; phase < tryPhases.length; phase++) {
      const preferWall = tryPhases[phase]
      let best: {
        row: number
        col: number
        colSpan: number
        rowSpan: number
        score: number
        tableOrientation?: TableOrientation
        storefront?: StorefrontSide
      } | null = null

      for (let i = 0; i < originsFlat.length; i += 2) {
        const row = originsFlat[i]
        const col = originsFlat[i + 1]

        const candidates = tent
          ? this.orientationCandidatesForVendor(vendor)
          : this.genericRowMode != null
            ? this.orientationCandidatesForVendor(vendor).filter((candidate) => {
                const { colSpan, rowSpan } = candidate
                if (row + rowSpan > this.rows || col + colSpan > this.cols) return false
                if (
                  !isGenericRowPlacement(
                    this.genericRowMode!,
                    row,
                    col,
                    rowSpan,
                    colSpan,
                    this.rows,
                    this.cols
                  )
                ) {
                  return false
                }
                for (let r = row; r < row + rowSpan; r++) {
                  for (let c = col; c < col + colSpan; c++) {
                    if (this.grid[r][c] !== 'empty') return false
                  }
                }
                return true
              })
            : this.useIndoorCorridor
            ? this.orientationCandidatesForVendor(vendor).filter((candidate) => {
                const { colSpan, rowSpan, storefront } = candidate
                if (row + rowSpan > this.rows || col + colSpan > this.cols) return false
                const inStructuredZone = isIndoorCorridorPlacement(
                      row,
                      col,
                      rowSpan,
                      colSpan,
                      this.rows,
                      this.cols
                    )
                if (!inStructuredZone) return false
                for (let r = row; r < row + rowSpan; r++) {
                  for (let c = col; c < col + colSpan; c++) {
                    if (this.grid[r][c] !== 'empty') return false
                  }
                }
                if (
                  placementViolatesStrollerSeparation(
                    this.boothRects,
                    row,
                    col,
                    rowSpan,
                    colSpan,
                    this.boothWidth,
                    this.boothLength,
                    1,
                    1,
                    this.walkway
                  )
                ) {
                  return false
                }
                const r1 = row + rowSpan - 1
                const c1 = col + colSpan - 1
                if (!boothHasAisleFrontage(row, col, r1, c1, this.rows, this.cols, this.walkway)) {
                  return false
                }
                return !storefrontSideFacesWall(
                  row,
                  col,
                  r1,
                  c1,
                  storefront,
                  this.rows,
                  this.cols,
                  this.walkway,
                  this.wallKeys
                )
              })
            : this.layoutPreset === 'l_shape_corners'
            ? this.orientationCandidatesForVendor(vendor).filter((candidate) => {
                const { colSpan, rowSpan } = candidate
                if (row + rowSpan > this.rows || col + colSpan > this.cols) return false
                if (
                  !isLShapeCornersPlacement(
                    row,
                    col,
                    rowSpan,
                    colSpan,
                    this.rows,
                    this.cols
                  )
                ) {
                  return false
                }
                for (let r = row; r < row + rowSpan; r++) {
                  for (let c = col; c < col + colSpan; c++) {
                    if (this.grid[r][c] !== 'empty') return false
                  }
                }
                const r1 = row + rowSpan - 1
                const c1 = col + colSpan - 1
                return boothHasAisleFrontage(row, col, r1, c1, this.rows, this.cols, this.walkway)
              })
            : this.useOutdoorClusters && !this.useIndoorCorridor
            ? this.orientationCandidatesForVendor(vendor).filter((candidate) => {
                const { colSpan, rowSpan } = candidate
                if (row + rowSpan > this.rows || col + colSpan > this.cols) return false
                if (
                  !isClusterPlacement(row, col, rowSpan, colSpan, this.rows, this.cols)
                ) {
                  return false
                }
                for (let r = row; r < row + rowSpan; r++) {
                  for (let c = col; c < col + colSpan; c++) {
                    if (this.grid[r][c] !== 'empty') return false
                  }
                }
                const r1 = row + rowSpan - 1
                const c1 = col + colSpan - 1
                return boothHasAisleFrontage(row, col, r1, c1, this.rows, this.cols, this.walkway)
              })
            : this.usePerimeterOnly
            ? (() => {
                const tableFt = vendor.tableLengthFt ?? 6
                const placed = perimeterPlacementAtOrigin(row, col, tableFt, this.rows, this.cols)
                if (!placed) return []
                const aligned = alignOriginToPerimeterWall(
                  row,
                  col,
                  placed.rowSpan,
                  placed.colSpan,
                  this.rows,
                  this.cols
                )
                const atWall = perimeterPlacementAtOrigin(
                  aligned.row,
                  aligned.col,
                  tableFt,
                  this.rows,
                  this.cols
                )
                if (!atWall) return []
                const { colSpan, rowSpan, orientation, storefront } = atWall
                if (aligned.row + rowSpan > this.rows || aligned.col + colSpan > this.cols) {
                  return []
                }
                if (
                  !isPerimeterPlacement(
                    aligned.row,
                    aligned.col,
                    rowSpan,
                    colSpan,
                    this.rows,
                    this.cols
                  )
                ) {
                  return []
                }
                for (let r = aligned.row; r < aligned.row + rowSpan; r++) {
                  for (let c = aligned.col; c < aligned.col + colSpan; c++) {
                    if (this.grid[r][c] !== 'empty') return []
                  }
                }
                if (
                  placementViolatesStrollerSeparation(
                    this.boothRects,
                    aligned.row,
                    aligned.col,
                    rowSpan,
                    colSpan,
                    this.boothWidth,
                    this.boothLength,
                    BOOTH_CORE_SEPARATION_CELLS,
                    BOOTH_CORE_SEPARATION_CELLS,
                    this.walkway
                  )
                ) {
                  return []
                }
                const r1 = aligned.row + rowSpan - 1
                const c1 = aligned.col + colSpan - 1
                if (
                  !boothStorefrontFacesPerimeterConcourse(
                    aligned.row,
                    aligned.col,
                    r1,
                    c1,
                    storefront,
                    this.rows,
                    this.cols,
                    this.walkway,
                    this.wallKeys
                  )
                ) {
                  return []
                }
                return [{ colSpan, rowSpan, orientation, storefront, alignedRow: aligned.row, alignedCol: aligned.col }]
              })()
            : (() => {
                const gridOccupied = (r: number, c: number) => {
                  if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return false
                  return this.grid[r][c] !== 'empty'
                }
                const oriented = resolveBoothSpansForWalkway(
                  row,
                  col,
                  vendor.tableLengthFt ?? 6,
                  this.rows,
                  this.cols,
                  this.walkway,
                  this.wallKeys,
                  gridOccupied,
                  (storefront, colSpan, rowSpan) =>
                    this.flowAlignmentBonus(row, col, colSpan, rowSpan, storefront)
                )
                if (oriented) return [oriented]
                const ctx = this.placementContext()
                return this.orientationCandidatesForVendor(vendor).filter((candidate) => {
                  const { colSpan, rowSpan } = candidate
                  if (row + rowSpan > this.rows || col + colSpan > this.cols) return false
                  return canPlaceAccessible(ctx, row, col, rowSpan, colSpan)
                })
              })()

        for (const candidate of candidates) {
          const {
            colSpan,
            rowSpan,
            orientation,
            storefront: baselineStorefront,
          } = candidate
          const slotRow =
            'alignedRow' in candidate && typeof candidate.alignedRow === 'number'
              ? candidate.alignedRow
              : row
          const slotCol =
            'alignedCol' in candidate && typeof candidate.alignedCol === 'number'
              ? candidate.alignedCol
              : col
          const placementStorefront = baselineStorefront
          if (
            this.useOutdoorClusters &&
            !this.useIndoorCorridor &&
            !this.genericRowMode &&
            !isClusterPlacement(row, col, rowSpan, colSpan, this.rows, this.cols)
          ) {
            continue
          }

          const ctx = this.placementContext(placementStorefront)
          const corridorBounds =
            this.useIndoorCorridor || this.genericRowMode
              ? computeInteriorBounds(this.cols, this.rows)
              : null
          const isolationOpts = {
            categoryKey,
            categoryIndex: this.categoryGuard.categoryIndex,
            bonusScore: (r: number, c: number, rs: number, cs: number) => {
              let score = 0
              if (requiresPowerVendor(vendor.requestedBoothType)) {
                score += powerRoutingScore(
                  r,
                  c,
                  rs,
                  cs,
                  this.powerRoutingTargets
                )
              }
              if (corridorBounds) {
                if (this.useModifiedLoop) {
                  score += scoreRightHandBias(
                    r,
                    c,
                    rs,
                    cs,
                    vendor.tier ?? 'standard',
                    this.entrance,
                    this.cols,
                    this.rows
                  )
                  score += scoreSightlineHierarchy(r, c, rs, cs, corridorBounds)
                } else if (this.genericRowMode) {
                  score += genericRowStorefrontBonus(
                    this.genericRowMode,
                    r,
                    c,
                    cs,
                    rs,
                    placementStorefront,
                    this.cols,
                    this.rows
                  )
                } else {
                  score += sharedAisleOrientationBonus(r, c, placementStorefront, corridorBounds)
                }
                score += this.flowAlignmentBonus(r, c, cs, rs, placementStorefront)
              }
              return score
            },
            rejectSlot: (r: number, c: number, cs: number) =>
              this.rejectsCategoryIsolation(categoryKey, r, c, rowSpan, cs),
          }
          const slots = buildAccessiblePlacementSlots(
            ctx,
            rowSpan,
            colSpan,
            [[slotRow, slotCol]],
            preferWall,
            isolationOpts,
            searchBudget
          )
          if (slots.length === 0) continue
          const score = slots[0].score
          if (!best || score > best.score) {
            best = {
              row: slotRow,
              col: slotCol,
              colSpan,
              rowSpan,
              score,
              tableOrientation: orientation,
              storefront: baselineStorefront,
            }
          }
        }
      }

      if (best) {
        return {
          row: best.row,
          col: best.col,
          colSpan: best.colSpan,
          rowSpan: best.rowSpan,
          tableOrientation: best.tableOrientation,
          storefront: best.storefront,
        }
      }
    }

    return null
  }

  private captureOverlapIfAny(): boolean {
    const overlap = detectLayoutOverlaps({
      cells: this.cells,
      rows: this.rows,
      cols: this.cols,
      venueElements: this.fixtures,
    })
    if (!overlap.hasOverlap) return false

    this.overlapKeys = overlap.overlapKeys
    this.stoppedOnOverlap = true
    this.capacityReached = true
    this.finalizeUnplaced()
    this.done = true
    return true
  }

  private triggerCapacityHalt(iterationLimit: boolean): void {
    this.capacityReached = true
    if (iterationLimit) {
      this.iterationLimitHit = true
    }
    this.finalizeUnplaced()
    this.finish()
  }

  private finalizeUnplaced(): void {
    const placedIds = new Set(this.cells.filter((c) => c.col >= 0).map((c) => c.id))
    for (let i = this.vendorIndex; i < this.vendorQueue.length; i++) {
      const vendor = this.vendorQueue[i]
      if (placedIds.has(vendor.id)) continue
      if (this.cells.some((c) => c.id === vendor.id)) continue
      this.cells.push(this.unplacedCell(vendor))
      placedIds.add(vendor.id)
    }
  }

  private finish(): void {
    this.sanitizePlacements()
    this.done = true
  }

  private sanitizePlacements(): void {
    if (this.sanitized) return
    let guard = 0
    const sanitizeBudget = new PlacementIterationBudget()
    while (guard++ < this.cells.length + 1) {
      if (sanitizeBudget.tick()) {
        this.iterationLimitHit = true
        this.capacityReached = true
        break
      }
      const check = validateAutoLayoutPlacement({
        cells: this.cells,
        rows: this.rows,
        cols: this.cols,
        blocked: this.blocked,
        venueElements: this.fixtures,
      })
      if (check.valid) break
      const placed = this.cells.filter((c) => c.col >= 0)
      if (placed.length === 0) break
      const last = placed[placed.length - 1]
      this.cells = this.cells.map((c) =>
        c.id === last.id
          ? {
              ...c,
              col: -1,
              row: -1,
              boothNumber: -1,
            }
          : c
      )
      this.capacityReached = true
    }
    this.sanitized = true
  }
}

export function createAutoLayoutSession(
  params: AutoLayoutParams,
  options?: AutoLayoutSessionOptions
): AutoLayoutSession {
  return new AutoLayoutSession(params, options)
}

export function autoLayout(params: AutoLayoutParams): AutoLayoutResult {
  return createAutoLayoutSession(params).runToCompletion()
}

/** Build an ordered list of [row, col] starting from the corner furthest from entrance */
function buildPlacementOrder(
  rows: number,
  cols: number,
  entrance: 'north' | 'south' | 'east' | 'west'
): [number, number][] {
  const order: [number, number][] = []

  let rowRange: number[]
  let colRange: number[]

  if (entrance === 'south') {
    rowRange = range(rows - 1, -1, -1)
    colRange = range(0, cols)
  } else if (entrance === 'north') {
    rowRange = range(0, rows)
    colRange = range(0, cols)
  } else if (entrance === 'west') {
    rowRange = range(0, rows)
    colRange = range(cols - 1, -1, -1)
  } else {
    rowRange = range(0, rows)
    colRange = range(0, cols)
  }

  for (let ri = 0; ri < rowRange.length; ri++) {
    const r = rowRange[ri]
    for (let ci = 0; ci < colRange.length; ci++) {
      order.push([r, colRange[ci]])
    }
  }

  return order
}

function flattenPlacementOrder(order: [number, number][]): Int32Array {
  const flat = new Int32Array(order.length * 2)
  for (let i = 0; i < order.length; i++) {
    flat[i * 2] = order[i][0]
    flat[i * 2 + 1] = order[i][1]
  }
  return flat
}

function flattenVendorQueue(
  vendors: VendorInput[],
  fcfsOrder: boolean,
  preset: LayoutPreset = 'default'
): VendorInput[] {
  if (preset === 'modified_loop') {
    const sorted = sortModifiedLoopVendorQueue(
      vendors.map((v) => ({
        id: v.id,
        name: v.vendorName,
        category: v.categoryName,
        categoryId: v.categoryId,
        tier: v.tier ?? 'standard',
        boothDimensions: { colSpan: v.colSpan, rowSpan: v.rowSpan },
        categoryColor: v.categoryColor,
      }))
    )
    const byId = new Map(vendors.map((v) => [v.id, v]))
    return sorted.map((s) => byId.get(s.id)!)
  }
  if (fcfsOrder) return [...vendors]
  const groups = groupVendorsByCategory(vendors)
  const queue: VendorInput[] = []
  for (let gi = 0; gi < groups.length; gi++) {
    const sortedGroup = [...groups[gi]].sort((a, b) => b.colSpan * b.rowSpan - a.colSpan * a.rowSpan)
    for (let vi = 0; vi < sortedGroup.length; vi++) {
      queue.push(sortedGroup[vi])
    }
  }
  return queue
}

function range(start: number, end: number, step = 1): number[] {
  const result: number[] = []
  if (step > 0) {
    for (let i = start; i < end; i += step) result.push(i)
  } else {
    for (let i = start; i > end; i += step) result.push(i)
  }
  return result
}

/** Group vendors by category; larger categories placed first for tighter packing. */
function groupVendorsByCategory(vendors: VendorInput[]): VendorInput[][] {
  const groups = new Map<string, VendorInput[]>()
  for (let i = 0; i < vendors.length; i++) {
    const v = vendors[i]
    const list = groups.get(v.categoryName) ?? []
    list.push(v)
    groups.set(v.categoryName, list)
  }

  return Array.from(groups.values()).sort((a, b) => {
    const footprint = (g: VendorInput[]) => {
      let sum = 0
      for (let i = 0; i < g.length; i++) sum += g[i].colSpan * g[i].rowSpan
      return sum
    }
    return footprint(b) - footprint(a)
  })
}
