'use client'

import { Trash2, Upload, HelpCircle } from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { BoothClearancePolicy, EventListingType } from '@/types/database'
import { WIZARD_TIME_OPTIONS } from './wizard-time-options'
import { DESCRIPTION_MIN_LENGTH } from '@/lib/wizard/critique/copy-audit'

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
  onCoverChange: (file: File) => void
  listingType: EventListingType
  onListingTypeChange: (v: EventListingType) => void
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

  return (
    <div className={WIZARD_PANEL_INNER}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={WIZARD_STEP_TITLE}>
          Step 1 — Core Market Setup
        </h2>
        <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">Draft</span>
      </div>

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
            🏡 Garage / Yard Sale
          </button>
        </div>
        {props.listingType === 'garage_yard_sale' ? (
          <p className={WIZARD_INFO_BOX}>
            Garage and yard sales go live on the patron map when published — no vendor booth applications or juried review required.
          </p>
        ) : null}
      </div>

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

      <div className="space-y-2">
        <Label className={WIZARD_FIELD_LABEL}>Schedule Type</Label>
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
      </div>

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
              ? 'text-amber-800'
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

      {props.scheduleType === 'single' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="wizard-start-date" className={WIZARD_FIELD_LABEL}>Start Date & Time *</Label>
            <Input
              id="wizard-start-date"
              type="date"
              value={props.startDate}
              onChange={(e) => props.onStartDateChange(e.target.value)}
              className={WIZARD_INPUT}
            />
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
          </div>
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
          </div>
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

      {props.listingType === 'community_market' ? (
        <>
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
      </div>

      <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-card p-4">
        <div>
          <p className="text-sm font-medium">Allow Direct Sales / MLM Vendors</p>
          <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal break-words">
            Enables MLM brand categories in the category selector.
          </p>
        </div>
        <Switch checked={props.allowMlm} onCheckedChange={props.onAllowMlmChange} className="ml-4 shrink-0" />
      </div>

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
        </>
      ) : null}

      <div className="space-y-1">
        <Label className={WIZARD_FIELD_LABEL}>Cover Image</Label>
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-stone-200 p-4 hover:bg-canvas transition-all duration-200">
          {props.coverImageUrl ? (
            <img src={props.coverImageUrl} alt="Cover" className="h-16 w-24 rounded-lg object-cover" />
          ) : (
            <div className="h-16 w-24 rounded-lg bg-canvas flex items-center justify-center">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium">{props.coverImageUrl ? 'Change cover' : 'Upload cover'}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP · 1200×400 recommended</p>
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) props.onCoverChange(file)
            }}
          />
        </label>
      </div>
    </div>
  )
}
