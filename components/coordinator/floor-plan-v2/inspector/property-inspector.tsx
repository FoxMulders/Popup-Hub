'use client'

import { useId, useMemo, useState } from 'react'
import type { FloorPlanDocStore } from '../state/use-floor-plan-doc'
import { isVendorBoothObject } from '../interactions/vendor-booth-placement'
import type {
  BoothObject,
  DoorObject,
  LabelObject,
  OpenWallObject,
  PlacedObject,
} from '../state/types'
import { cn } from '@/lib/utils'
import { boothHasTableCluster } from '../state/table-cluster-layout'
import {
  inspectorControlClassName,
  inspectorFieldsetClass,
  inspectorLabelClass,
  inspectorLegendClass,
} from './inspector-field-styles'
import { TableClusterFields } from './table-cluster-fields'
import { CanvasEditor } from '../canvas/canvas-editor'

const INSPECTOR_ASIDE_CLASS =
  '@container flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 text-xs'

interface PropertyInspectorProps {
  store: FloorPlanDocStore
  /**
   * Sorted list of category names defined for this event (Step 2 of
   * the wizard). When provided the booth Category field renders as a
   * dropdown of these names plus a "Custom…" escape hatch; when empty
   * we fall back to free-text entry so the inspector still works on
   * events that don't yet have a category list.
   */
  eventCategoryNames?: string[]
  /** Turf-validated shelf pack for vendor booths in the active room. */
  onAutoArrange?: () => void
  canAutoArrange?: boolean
  autoArrangeDisabledReason?: string | null
  /** Run intelligent bin-pack + patron pathfind for the active room. */
  onAutoLayoutAndPathfind?: () => void
  canAutoLayoutAndPathfind?: boolean
  className?: string
}

/**
 * On-demand property inspector. Renders the editable fields for the
 * currently selected object(s). When nothing is selected we show the
 * canvas-level properties (advisory venue size, grid, snap).
 *
 * This panel is purely cosmetic / data-entry — it never blocks placement,
 * never enforces constraints, and never auto-applies presets. Edits flow
 * through the doc store immutably.
 */
export function PropertyInspector({
  store,
  eventCategoryNames,
  onAutoArrange,
  canAutoArrange = false,
  autoArrangeDisabledReason,
  onAutoLayoutAndPathfind,
  canAutoLayoutAndPathfind = false,
  className,
}: PropertyInspectorProps) {
  const selected = useMemo(() => {
    return store.doc.objects.filter((o) => store.selectedIds.has(o.id))
  }, [store.doc.objects, store.selectedIds])

  if (selected.length === 0) {
    return (
      <aside
        className={cn(INSPECTOR_ASIDE_CLASS, className)}
        aria-label="Canvas properties"
      >
        <header>
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-wide text-stone-700">
            Canvas
          </h2>
          <p className="mt-0.5 text-[0.625rem] leading-snug text-stone-500 sm:text-xs">
            No object selected. Pick an object to edit its properties, or
            tweak the advisory canvas settings below.
          </p>
        </header>
        {onAutoArrange ? (
          <CanvasEditor
            onAutoArrange={onAutoArrange}
            canAutoArrange={canAutoArrange}
            disabledReason={autoArrangeDisabledReason}
          />
        ) : null}
        {onAutoLayoutAndPathfind ? (
          <section aria-label="Layout automation">
            <button
              type="button"
              onClick={onAutoLayoutAndPathfind}
              disabled={!canAutoLayoutAndPathfind}
              className={cn(
                'w-full rounded-md border px-3 py-2 text-left text-[0.6875rem] font-semibold transition-colors',
                canAutoLayoutAndPathfind
                  ? 'border-sky-300 bg-sky-50 text-sky-900 hover:bg-sky-100'
                  : 'cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400'
              )}
              title={
                canAutoLayoutAndPathfind
                  ? 'Pack vendor booths inside merged zones with 5′ aisles, then compute patron traffic path'
                  : 'Draw at least one vendor booth in the active room first'
              }
            >
              Auto-Layout &amp; Pathfind
            </button>
            <p className="mt-1.5 text-[0.625rem] leading-snug text-stone-500">
              Clears vendor booth positions, packs inside merged zones with
              5′ aisles, and draws the optimal viewing path.
            </p>
          </section>
        ) : null}
        <section aria-label="Canvas dimensions">
          <fieldset className={cn(inspectorFieldsetClass, 'flex flex-col gap-3')}>
            <legend className="sr-only">Canvas dimensions and snap</legend>
            <NumberField
              label="Width (ft)"
              value={store.doc.canvasWidthFt}
              min={5}
              step={1}
              onChange={(v) => store.patchDoc({ canvasWidthFt: v })}
            />
            <NumberField
              label="Length (ft)"
              value={store.doc.canvasLengthFt}
              min={5}
              step={1}
              onChange={(v) => store.patchDoc({ canvasLengthFt: v })}
            />
            <NumberField
              label="Snap (ft)"
              value={store.doc.snapFt}
              min={0}
              step={0.5}
              onChange={(v) => store.patchDoc({ snapFt: v })}
            />
          </fieldset>
          <p className="mt-2 text-[0.625rem] leading-snug text-stone-500 sm:text-xs">
            Snap = 0 disables grid snapping for free-form placement.
          </p>
        </section>
      </aside>
    )
  }

  if (selected.length > 1) {
    const vendorSelected = selected.filter(isVendorBoothObject)
    const nonVendorCount = selected.length - vendorSelected.length
    const title =
      vendorSelected.length > 0
        ? `${vendorSelected.length} Vendor${vendorSelected.length === 1 ? '' : 's'} Selected`
        : `${selected.length} selected`
    const subtitle =
      vendorSelected.length > 0 && nonVendorCount > 0
        ? `${nonVendorCount} structural or non-vendor element${nonVendorCount === 1 ? '' : 's'} also selected — shared fields apply to vendors only.`
        : 'Multi-select editing for shared fields only.'

    return (
      <aside
        className={cn(INSPECTOR_ASIDE_CLASS, className)}
        aria-label="Multi selection properties"
      >
        <header>
          <h2 className="text-[0.6875rem] font-bold uppercase tracking-wide text-stone-700">
            {title}
          </h2>
          <p className="mt-0.5 text-[0.625rem] text-stone-500 sm:text-xs">
            {subtitle}
          </p>
        </header>
        <section aria-label="Bulk actions">
          <BulkLockToggle store={store} ids={selected.map((s) => s.id)} />
        </section>
      </aside>
    )
  }

  const obj = selected[0]
  const boothWithCluster =
    obj.kind === 'booth' && boothHasTableCluster(obj as BoothObject)

  return (
    <aside
      className={cn(INSPECTOR_ASIDE_CLASS, className)}
      aria-label={`${obj.kind} properties`}
    >
      <header>
        <h2 className="text-[0.6875rem] font-bold uppercase tracking-wide text-stone-700">
          {obj.kind}
        </h2>
        <p className="mt-0.5 text-[0.625rem] text-stone-500 sm:text-xs">
          {prettyKindHint(obj.kind)}
        </p>
      </header>

      <section aria-label="Position and dimensions">
        <fieldset className={cn(inspectorFieldsetClass, 'flex flex-col gap-3')}>
          <legend className={inspectorLegendClass}>Geometry</legend>
          <PositionFields store={store} obj={obj} />
          {boothWithCluster ? (
            <p className="text-[0.625rem] text-stone-500 sm:text-xs">
              Size is derived from the angled sub-table footprint.
            </p>
          ) : (
            <SizeFields store={store} obj={obj} />
          )}
          <NumberField
            label="Rotation (°)"
            value={obj.rotation}
            min={-180}
            max={180}
            step={15}
            onChange={(v) => store.updateObject(obj.id, { rotation: v })}
          />
        </fieldset>
      </section>

      <KindSpecificFields
        store={store}
        obj={obj}
        eventCategoryNames={eventCategoryNames}
      />

      <section aria-label="Object lock">
        <LockToggle store={store} obj={obj} />
      </section>
    </aside>
  )
}

function prettyKindHint(kind: PlacedObject['kind']): string {
  switch (kind) {
    case 'booth':
      return 'Vendor footprint. Bind a vendor or set a category color.'
    case 'wall':
      return 'Solid barrier — purely visual; no placement enforcement.'
    case 'open_wall':
      return 'Service window (food trucks / concessions). Snap flush to walls and tune counter depth.'
    case 'door':
      return 'Entrance or exit marker. Position freely along walls.'
    case 'emergency_exit':
      return 'Emergency egress. Keep paths clear and visible.'
    case 'stage':
      return 'Performance area. Re-size to match the platform footprint.'
    case 'food_truck':
      return 'Mobile concession unit. Place on open canvas or parking areas — cannot overlap solid walls.'
    case 'label':
      return 'Free-form text annotation.'
    case 'merged_zone':
      return 'Boolean-merged shape. Unjoin by deleting and re-drawing, or undo.'
  }
}

function PositionFields({
  store,
  obj,
}: {
  store: FloorPlanDocStore
  obj: PlacedObject
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label="X (ft)"
        value={obj.x}
        step={store.doc.snapFt || 0.5}
        onChange={(v) => store.updateObject(obj.id, { x: v })}
      />
      <NumberField
        label="Y (ft)"
        value={obj.y}
        step={store.doc.snapFt || 0.5}
        onChange={(v) => store.updateObject(obj.id, { y: v })}
      />
    </div>
  )
}

function SizeFields({
  store,
  obj,
}: {
  store: FloorPlanDocStore
  obj: PlacedObject
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <NumberField
        label="W (ft)"
        value={obj.width}
        min={0.5}
        step={store.doc.snapFt || 0.5}
        onChange={(v) => store.updateObject(obj.id, { width: v })}
      />
      <NumberField
        label="H (ft)"
        value={obj.height}
        min={0.5}
        step={store.doc.snapFt || 0.5}
        onChange={(v) => store.updateObject(obj.id, { height: v })}
      />
    </div>
  )
}

function KindSpecificFields({
  store,
  obj,
  eventCategoryNames,
}: {
  store: FloorPlanDocStore
  obj: PlacedObject
  eventCategoryNames?: string[]
}) {
  if (obj.kind === 'booth') {
    const booth = obj as BoothObject
    return (
      <>
        <section aria-label="Booth details">
          <fieldset className={cn(inspectorFieldsetClass, 'flex flex-col gap-3')}>
            <legend className={inspectorLegendClass}>Booth</legend>
            <TextField
              label="Vendor name"
              value={booth.label ?? ''}
              onChange={(v) => store.updateObject(obj.id, { label: v })}
            />
            <CategoryField
              value={booth.categoryName ?? ''}
              options={eventCategoryNames ?? []}
              onChange={(v) =>
                store.updateObject(obj.id, { categoryName: v || null })
              }
            />
            <TextField
              label="Accent color (hex)"
              value={booth.accentColor ?? ''}
              placeholder="#fde68a"
              onChange={(v) =>
                store.updateObject(obj.id, { accentColor: v || null })
              }
            />
          </fieldset>
        </section>
        <TableClusterFields store={store} booth={booth} />
      </>
    )
  }
  if (obj.kind === 'door') {
    const door = obj as DoorObject
    return (
      <section aria-label="Door details">
      <SelectField
        label="Door type"
        value={door.doorType}
        options={[
          { value: 'entrance', label: 'Entrance' },
          { value: 'exit', label: 'Exit' },
        ]}
        onChange={(v) =>
          store.updateObject(obj.id, {
            doorType: v as DoorObject['doorType'],
          })
        }
      />
      </section>
    )
  }
  if (obj.kind === 'open_wall') {
    const ow = obj as OpenWallObject
    return (
      <section aria-label="Service window details">
        <fieldset className={cn(inspectorFieldsetClass, 'flex flex-col gap-3')}>
          <legend className={inspectorLegendClass}>Open wall</legend>
          <TextField
            label="Window label"
            value={ow.label ?? ''}
            placeholder="e.g. Taco truck pickup"
            onChange={(v) => store.updateObject(obj.id, { label: v })}
          />
          <NumberField
            label="Counter depth (ft)"
            value={ow.counterDepthFt ?? 1.5}
            min={0.5}
            step={0.5}
            onChange={(v) =>
              store.updateObject(obj.id, { counterDepthFt: v })
            }
          />
        </fieldset>
      </section>
    )
  }
  if (obj.kind === 'label') {
    const label = obj as LabelObject
    return (
      <section aria-label="Label text">
        <TextField
          label="Text"
          value={label.text}
          onChange={(v) => store.updateObject(obj.id, { text: v })}
        />
      </section>
    )
  }
  return null
}

function LockToggle({
  store,
  obj,
}: {
  store: FloorPlanDocStore
  obj: PlacedObject
}) {
  return (
    <label className="flex min-h-10 cursor-pointer items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs text-stone-700 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-600 has-[:focus-visible]:ring-offset-1">
      <span>Locked</span>
      <input
        type="checkbox"
        checked={!!obj.locked}
        onChange={(e) =>
          store.updateObject(obj.id, { locked: e.target.checked })
        }
        className="size-4 rounded border-stone-300 text-sky-600 focus-visible:outline-none"
      />
    </label>
  )
}

function BulkLockToggle({
  store,
  ids,
}: {
  store: FloorPlanDocStore
  ids: string[]
}) {
  return (
    <button
      type="button"
      onClick={() =>
        store.updateObjects(
          ids.map((id) => ({ id, patch: { locked: true } }))
        )
      }
      className={cn(
        'min-h-10 rounded-md border border-stone-200 bg-stone-50 px-2 py-1.5 text-xs font-semibold text-stone-700 transition-colors duration-150 hover:bg-stone-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-1'
      )}
    >
      Lock all selected
    </button>
  )
}

interface NumberFieldProps {
  label: string
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: NumberFieldProps) {
  const fieldId = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={inspectorLabelClass}>
        {label}
      </label>
      <input
        id={fieldId}
        type="number"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={(e) => {
          const next = parseFloat(e.target.value)
          if (Number.isFinite(next)) onChange(next)
        }}
        className={inspectorControlClassName()}
      />
    </div>
  )
}

interface TextFieldProps {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
}

function TextField({ label, value, placeholder, onChange }: TextFieldProps) {
  const fieldId = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={inspectorLabelClass}>
        {label}
      </label>
      <input
        id={fieldId}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inspectorControlClassName()}
      />
    </div>
  )
}

interface SelectFieldProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (v: string) => void
}

function SelectField({ label, value, options, onChange }: SelectFieldProps) {
  const fieldId = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={fieldId} className={inspectorLabelClass}>
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inspectorControlClassName()}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface CategoryFieldProps {
  value: string
  options: string[]
  onChange: (next: string) => void
}

/** Sentinel `<option>` value for entering a free-form category name. */
const CATEGORY_CUSTOM_VALUE = '__custom__'

/**
 * Booth Category field.
 *
 * The wizard owns the canonical list of categories for the event
 * (Step 2 capacity matrix). On the layout canvas, picking a category
 * for a booth should be a one-tap dropdown that pulls from that list,
 * not a free-form text box where coordinators have to remember exact
 * spelling.
 *
 * Behaviour:
 *  - When `options` is non-empty, render a `<select>`. The current
 *    value is preselected; "— No category —" clears the field.
 *  - If the booth's existing `value` isn't in `options` (e.g. an
 *    older booth carries a custom name, or the coordinator hasn't
 *    defined any categories yet), the dropdown automatically falls
 *    into "Custom…" mode with a text input pre-filled with that name
 *    so existing data is preserved and editable.
 *  - When `options` is empty (event with no category list yet) we
 *    skip the dropdown entirely and render the plain text field —
 *    nothing useful would go in the menu otherwise.
 */
function CategoryField({ value, options, onChange }: CategoryFieldProps) {
  const trimmed = value.trim()
  const matchesOption = trimmed.length > 0 && options.includes(trimmed)
  const startsCustom = trimmed.length > 0 && !matchesOption

  // `customMode` is sticky once the user opens the custom input, so
  // typing characters that briefly match an option (e.g. "Cra") doesn't
  // yank the input out from under them. Called before the no-options
  // fallback so hook order stays stable.
  const [customMode, setCustomMode] = useState(startsCustom)
  const selectId = useId()
  const customId = useId()

  // No event-level categories defined: degrade to a plain text field
  // so the inspector still works on legacy / category-less events.
  // The hook above is still called every render so order is stable.
  if (options.length === 0) {
    return (
      <TextField
        label="Category"
        value={value}
        placeholder="e.g. Crafts"
        onChange={onChange}
      />
    )
  }

  const selectValue = customMode
    ? CATEGORY_CUSTOM_VALUE
    : matchesOption
      ? trimmed
      : ''

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className={inspectorLabelClass}>
        Category
      </label>
      <select
        id={selectId}
        value={selectValue}
        onChange={(e) => {
          const next = e.target.value
          if (next === CATEGORY_CUSTOM_VALUE) {
            setCustomMode(true)
            return
          }
          setCustomMode(false)
          onChange(next)
        }}
        className={inspectorControlClassName()}
        aria-controls={customMode ? customId : undefined}
      >
        <option value="">— No category —</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
        <option value={CATEGORY_CUSTOM_VALUE}>Custom…</option>
      </select>
      {customMode ? (
        <input
          id={customId}
          type="text"
          value={value}
          autoFocus
          placeholder="Custom category name"
          onChange={(e) => onChange(e.target.value)}
          className={cn(inspectorControlClassName(), 'mt-1')}
          aria-label="Custom category name"
        />
      ) : null}
    </div>
  )
}
