'use client'

import { Trash2, HelpCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CLEARANCE_POLICY_OPTIONS } from '@/lib/booth-clearance-policy'
import { selectValueOrNull } from '@/lib/wizard/wizard-autosave'
import {
  WIZARD_CALLOUT,
  WIZARD_DRAFT_BADGE,
  WIZARD_FIELD_LABEL,
  WIZARD_INFO_BOX,
  WIZARD_INPUT,
  WIZARD_PANEL_INNER,
  WIZARD_SELECT_CONTENT,
  WIZARD_SELECT_ITEM,
  WIZARD_SELECT_TRIGGER,
  WIZARD_STEP_TITLE,
  WIZARD_TEXTAREA,
  WIZARD_TOGGLE_GROUP,
  WIZARD_TOGGLE_OPTION,
  WIZARD_TOGGLE_OPTION_ACTIVE,
  WIZARD_TOGGLE_OPTION_INACTIVE,
} from '@/lib/wizard/wizard-panel-styles'
import { ScheduleWeekendShortcuts } from '@/components/shared/schedule-weekend-shortcuts'
import { cn } from '@/lib/utils'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import type { BoothClearancePolicy, EventListingType } from '@/types/database'
import { WIZARD_TIME_OPTIONS } from './wizard-time-options'
import { DESCRIPTION_MIN_LENGTH } from '@/lib/wizard/critique/copy-audit'
import { FlyerCoverUpload } from '@/components/coordinator/flyer-cover-upload'
import { FlyerFieldHighlight } from '@/components/coordinator/flyer-field-highlight'
import type { FlyerFieldKey } from '@/lib/flyer/types'

export interface DayRow {
  date: string
  start_time: string
  end_time: string
}

export interface WizardStepEventDetailsProps {
  name: string
  onNameChange: (v: string) => void
  description: string
  onDescriptionChange: (v: string) => void
  scheduleType: 'single' | 'multi'
  onScheduleTypeChange: (v: 'single' | 'multi') => void
  startDate: string
  onStartDateChange: (v: string) => void
  startTime: string
  onStartTimeChange: (v: string) => void
  endDate: string
  onEndDateChange: (v: string) => void
  endTime: string
  onEndTimeChange: (v: string) => void
  dayRows: DayRow[]
  onDayRowsChange: (rows: DayRow[]) => void
  bookingMode: 'instant' | 'juried'
  onBookingModeChange: (v: 'instant' | 'juried') => void
  allowMlm: boolean
  onAllowMlmChange: (v: boolean) => void
  boothClearancePolicy: BoothClearancePolicy
  onBoothClearancePolicyChange: (v: BoothClearancePolicy) => void
  raffleDonationRequirement: string
  onRaffleDonationRequirementChange: (v: string) => void
  coverImageUrl: string
  onCoverFileSelected: (file: File) => void
  parsingFlyer?: boolean
  autoFilledFields?: Set<FlyerFieldKey>
  listingType: EventListingType
  onListingTypeChange: (v: EventListingType) => void
  requireFullAttendance: boolean
  onRequireFullAttendanceChange: (v: boolean) => void
  marketInsuranceRequired: boolean
  onMarketInsuranceRequiredChange: (v: boolean) => void
  onApplyWeekendRange: (range: { startDate: string; endDate: string }) => void
}

export function WizardStepEventDetails(props: WizardStepEventDetailsProps) {
  function updateDayRow(index: number, field: keyof DayRow, value: string) {
    props.onDayRowsChange(
      props.dayRows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  function addDayRow() {
    props.onDayRowsChange([
      ...props.dayRows,
      { date: '', start_time: '08:00', end_time: '15:00' },
    ])
  }

  function removeDayRow(index: number) {
    props.onDayRowsChange(props.dayRows.filter((_, i) => i !== index))
  }

  const autoFilled = props.autoFilledFields ?? new Set<FlyerFieldKey>()

  return (
    <div className={cn(WIZARD_PANEL_INNER, 'relative')}>
      {props.parsingFlyer ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-cream/75 backdrop-blur-[2px]"
          aria-hidden
        >
          <div className="mx-4 max-w-sm rounded-xl border border-harvest-200 bg-white px-5 py-4 text-center shadow-lg">
            <p className="text-sm font-semibold text-harvest-800">✨ AI is reading your poster details…</p>
            <p className="mt-1 text-xs text-muted-foreground">
              We&apos;ll fill in matching fields when ready. You can edit everything afterward.
            </p>
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={WIZARD_STEP_TITLE}>
          Step 1 — Core Event Setup
        </h2>
        <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">Draft</span>
      </div>

      <FlyerCoverUpload
        coverImageUrl={props.coverImageUrl}
        onFileSelected={props.onCoverFileSelected}
        parsing={props.parsingFlyer}
        label="Cover Image / Flyer"
      />

      <div className="space-y-2">
        <Label className={WIZARD_FIELD_LABEL}>Listing Type</Label>
        <div className={WIZARD_TOGGLE_GROUP}>
          <button
            type="button"
            onClick={() => props.onListingTypeChange('community_market')}
            className={cn(
              WIZARD_TOGGLE_OPTION,
              props.listingType === 'community_market'
                ? WIZARD_TOGGLE_OPTION_ACTIVE
                : WIZARD_TOGGLE_OPTION_INACTIVE
            )}
          >
            🎪 Community Market
          </button>
          <button
            type="button"
            onClick={() => props.onListingTypeChange('garage_yard_sale')}
            className={cn(
              WIZARD_TOGGLE_OPTION,
              props.listingType === 'garage_yard_sale'
                ? WIZARD_TOGGLE_OPTION_ACTIVE
                : WIZARD_TOGGLE_OPTION_INACTIVE
            )}
          >
            🪙 Quarter Auction
          </button>
        </div>
        {props.listingType === 'garage_yard_sale' ? (
          <p className={WIZARD_INFO_BOX}>
            Quarter auctions appear on the patron map when published. Vendor booth applications are required —
            instant book or juried review, depending on booking mode below. There is no assigned floor-plan booth
            placement; set category caps on step 3 and run the live quarter auction from the coordinator dashboard.
          </p>
        ) : null}
      </div>

      <FlyerFieldHighlight fieldKey="name" autoFilledFields={autoFilled}>
        <div className="space-y-1">
          <Label htmlFor="wizard-event-name" className={WIZARD_FIELD_LABEL}>Event Name *</Label>
          <Input
            id="wizard-event-name"
            value={props.name}
            onChange={(e) => props.onNameChange(e.target.value)}
            placeholder="e.g. Spring Makers Market"
            className={WIZARD_INPUT}
          />
        </div>
      </FlyerFieldHighlight>

      <div className="space-y-2">
        <Label className={WIZARD_FIELD_LABEL}>Schedule Type</Label>
        {props.listingType === 'garage_yard_sale' ? (
          <p className={WIZARD_INFO_BOX}>
            Quarter auctions are limited to a single day. Multi-day scheduling is not available for this
            listing type.
          </p>
        ) : (
          <div className={WIZARD_TOGGLE_GROUP}>
            {(['single', 'multi'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => props.onScheduleTypeChange(type)}
                className={cn(
                  WIZARD_TOGGLE_OPTION,
                  props.scheduleType === type
                    ? WIZARD_TOGGLE_OPTION_ACTIVE
                    : WIZARD_TOGGLE_OPTION_INACTIVE
                )}
              >
                {type === 'single' ? 'Single Day' : 'Multi-Day'}
              </button>
            ))}
          </div>
        )}
        <ScheduleWeekendShortcuts
          scheduleType={
            isQuarterAuctionListing(props.listingType) ? 'single' : props.scheduleType
          }
          onApply={props.onApplyWeekendRange}
        />
      </div>

      <FlyerFieldHighlight fieldKey="description" autoFilledFields={autoFilled}>
        <div className="space-y-1">
          <Label htmlFor="wizard-description" className={WIZARD_FIELD_LABEL}>Description</Label>
          <Textarea
            id="wizard-description"
            value={props.description}
            onChange={(e) => props.onDescriptionChange(e.target.value)}
            rows={3}
            maxLength={800}
            placeholder="Example: Kilkenny indoor makers market — local artisans, baked goods, and vintage finds near 71 St. Family-friendly Saturday shopping."
            className={WIZARD_TEXTAREA}
          />
        <p
          className={cn(
            'text-xs text-right tabular-nums',
            props.description.trim().length < DESCRIPTION_MIN_LENGTH
              ? 'text-harvest-700'
              : 'text-muted-foreground'
          )}
        >
          {props.description.trim().length}/{DESCRIPTION_MIN_LENGTH} min · {props.description.length}/800
          {props.description.trim().length < DESCRIPTION_MIN_LENGTH ? (
            <span className="block text-left mt-0.5 whitespace-normal break-words">
              Add vendor mix, location highlights, or shopper experience to clear the QA warning.
            </span>
          ) : null}
        </p>
        </div>
      </FlyerFieldHighlight>

      {props.scheduleType === 'single' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FlyerFieldHighlight fieldKey="startDate" autoFilledFields={autoFilled}>
            <div className="space-y-1">
              <Label htmlFor="wizard-start-date" className={WIZARD_FIELD_LABEL}>Start Date & Time *</Label>
              <Input
                id="wizard-start-date"
                type="date"
                value={props.startDate}
                onChange={(e) => props.onStartDateChange(e.target.value)}
                className={WIZARD_INPUT}
              />
              <FlyerFieldHighlight fieldKey="startTime" autoFilledFields={autoFilled} className="!p-0 !m-0 !ring-0 !bg-transparent">
                <Select
                  value={props.startTime}
                  onValueChange={(v) => {
                    const next = selectValueOrNull(v)
                    if (next) props.onStartTimeChange(next)
                  }}
                >
                  <SelectTrigger className={WIZARD_SELECT_TRIGGER}>
                    <SelectValue placeholder="Start time" />
                  </SelectTrigger>
                  <SelectContent className={WIZARD_SELECT_CONTENT}>
                    {WIZARD_TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className={WIZARD_SELECT_ITEM}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FlyerFieldHighlight>
            </div>
          </FlyerFieldHighlight>
          <FlyerFieldHighlight fieldKey="endDate" autoFilledFields={autoFilled}>
            <div className="space-y-1">
              <Label htmlFor="wizard-end-date" className={WIZARD_FIELD_LABEL}>End Date & Time *</Label>
              <Input
                id="wizard-end-date"
                type="date"
                value={props.endDate}
                min={props.startDate}
                onChange={(e) => props.onEndDateChange(e.target.value)}
                className={WIZARD_INPUT}
              />
              <FlyerFieldHighlight fieldKey="endTime" autoFilledFields={autoFilled} className="!p-0 !m-0 !ring-0 !bg-transparent">
                <Select
                  value={props.endTime}
                  onValueChange={(v) => {
                    const next = selectValueOrNull(v)
                    if (next) props.onEndTimeChange(next)
                  }}
                >
                  <SelectTrigger className={WIZARD_SELECT_TRIGGER}>
                    <SelectValue placeholder="End time" />
                  </SelectTrigger>
                  <SelectContent className={WIZARD_SELECT_CONTENT}>
                    {WIZARD_TIME_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className={WIZARD_SELECT_ITEM}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FlyerFieldHighlight>
            </div>
          </FlyerFieldHighlight>
        </div>
      ) : (
        <div className="space-y-3">
          <Label className={WIZARD_FIELD_LABEL}>Market Days *</Label>
          {props.dayRows.map((row, i) => (
            <div key={`day-${i}`} className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={row.date}
                onChange={(e) => updateDayRow(i, 'date', e.target.value)}
                className={cn(WIZARD_INPUT, 'w-40 shrink-0')}
              />
              <Select
                value={row.start_time}
                onValueChange={(v) => {
                  const next = selectValueOrNull(v)
                  if (next) updateDayRow(i, 'start_time', next)
                }}
              >
                <SelectTrigger className={cn(WIZARD_SELECT_TRIGGER, 'w-36')}>
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent className={WIZARD_SELECT_CONTENT}>
                  {WIZARD_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className={WIZARD_SELECT_ITEM}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground text-sm">to</span>
              <Select
                value={row.end_time}
                onValueChange={(v) => {
                  const next = selectValueOrNull(v)
                  if (next) updateDayRow(i, 'end_time', next)
                }}
              >
                <SelectTrigger className={cn(WIZARD_SELECT_TRIGGER, 'w-36')}>
                  <SelectValue placeholder="End" />
                </SelectTrigger>
                <SelectContent className={WIZARD_SELECT_CONTENT}>
                  {WIZARD_TIME_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className={WIZARD_SELECT_ITEM}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {props.dayRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeDayRow(i)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-500"
                  aria-label="Remove day"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={addDayRow}
            className="w-full rounded-lg border-2 border-dashed border-stone-200 py-2 text-sm text-muted-foreground hover:bg-canvas transition-all duration-200"
          >
            + Add Another Day
          </button>
        </div>
      )}

      {props.scheduleType === 'multi' ? (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-stone-200 bg-canvas px-4 py-3">
          <div className="space-y-1">
            <Label htmlFor="wizard-require-full-attendance" className={WIZARD_FIELD_LABEL}>
              Require attendance for all event days
            </Label>
            <p className="text-xs text-muted-foreground">
              Turn this off if vendors are allowed to apply for single or partial days.
            </p>
          </div>
          <Switch
            id="wizard-require-full-attendance"
            checked={props.requireFullAttendance}
            onCheckedChange={props.onRequireFullAttendanceChange}
          />
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4 rounded-xl border border-stone-200 bg-canvas px-4 py-3">
        <div className="space-y-1">
          <Label htmlFor="wizard-market-insurance-required" className={WIZARD_FIELD_LABEL}>
            Require Market Insurance from Vendors?
          </Label>
          <p className="text-xs text-muted-foreground">
            Approved vendors must upload proof of insurance before their booth is finalized.
          </p>
        </div>
        <Switch
          id="wizard-market-insurance-required"
          checked={props.marketInsuranceRequired}
          onCheckedChange={props.onMarketInsuranceRequiredChange}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="wizard-booking-mode" className={WIZARD_FIELD_LABEL}>Booking Mode</Label>
          <Select
            value={props.bookingMode}
            onValueChange={(v) => {
              const next = selectValueOrNull(v)
              if (next === 'instant' || next === 'juried') props.onBookingModeChange(next)
            }}
          >
            <SelectTrigger id="wizard-booking-mode" className={WIZARD_SELECT_TRIGGER}>
              <SelectValue placeholder="Select booking mode">
                {props.bookingMode === 'instant' ? 'Instant Book' : 'Juried Approval'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={WIZARD_SELECT_CONTENT}>
              <SelectItem value="instant" className={WIZARD_SELECT_ITEM}>
                Instant Book
              </SelectItem>
              <SelectItem value="juried" className={WIZARD_SELECT_ITEM}>
                Juried Approval
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        {props.listingType === 'community_market' ? (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="wizard-clearance" className={WIZARD_FIELD_LABEL}>Clean up and/or tear down</Label>
            <Tooltip>
              <TooltipTrigger type="button">
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs whitespace-normal break-words">
                Whether vendors must submit a photo when leaving and whether tables stay in place.
              </TooltipContent>
            </Tooltip>
          </div>
          <Select
            value={props.boothClearancePolicy}
            onValueChange={(v) => {
              const next = selectValueOrNull(v)
              if (next) props.onBoothClearancePolicyChange(next as BoothClearancePolicy)
            }}
          >
            <SelectTrigger id="wizard-clearance" className={WIZARD_SELECT_TRIGGER}>
              <SelectValue placeholder="Select policy">
                {CLEARANCE_POLICY_OPTIONS.find((o) => o.value === props.boothClearancePolicy)?.label ??
                  'Select policy'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className={WIZARD_SELECT_CONTENT}>
              {CLEARANCE_POLICY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className={WIZARD_SELECT_ITEM}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        ) : null}
      </div>

      {props.listingType === 'community_market' ? (
        <>
      <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-card p-4">
        <div>
          <p className="text-sm font-medium">Allow Direct Sales / MLM Vendors</p>
          <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal break-words">
            Enables MLM brand categories in the category selector.
          </p>
        </div>
        <Switch checked={props.allowMlm} onCheckedChange={props.onAllowMlmChange} className="ml-4 shrink-0" />
      </div>

      <FlyerFieldHighlight fieldKey="raffleDonationRequirement" autoFilledFields={autoFilled}>
        <div className="space-y-1">
          <Label htmlFor="wizard-raffle" className={WIZARD_FIELD_LABEL}>Raffle Donation Requirement</Label>
          <Textarea
            id="wizard-raffle"
            value={props.raffleDonationRequirement}
            onChange={(e) => props.onRaffleDonationRequirementChange(e.target.value)}
            placeholder="Optional — describe raffle or donation expectations for vendors"
            rows={2}
            className={WIZARD_TEXTAREA}
          />
        </div>
      </FlyerFieldHighlight>
        </>
      ) : null}

    </div>
  )
}
