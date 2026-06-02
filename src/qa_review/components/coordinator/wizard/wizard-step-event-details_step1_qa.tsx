'use client'

import { buildNextEventDayRow } from '@/lib/events/event-day-rows'
import { Trash2, HelpCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  WizardFloatingInput,
  WizardFloatingTextarea,
  WizardSelectionCard,
  WizardSelectionGroup,
  WizardSwitchRow,
  WizardZone,
} from '@/components/coordinator/wizard/wizard-ui'
import { WizardDescriptionFieldQa } from '@/src/qa_review/components/coordinator/wizard/wizard-description-field_qa'
import { WizardPaymentPreviewStripQa } from '@/src/qa_review/components/coordinator/wizard/wizard-payment-preview-strip_qa'
import type { VendorPaymentMethodKey } from '@/src/qa_review/lib/wizard/vendor-payment-methods_qa'
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
  WIZARD_SELECT_CONTENT,
  WIZARD_SELECT_ITEM,
  WIZARD_SELECT_TRIGGER,
} from '@/lib/wizard/wizard-panel-styles'
import { ScheduleWeekendShortcuts } from '@/components/shared/schedule-weekend-shortcuts'
import { cn } from '@/lib/utils'
import { isQuarterAuctionListing } from '@/lib/events/listing-type'
import type { BoothClearancePolicy, EventListingType } from '@/types/database'
import { WIZARD_TIME_OPTIONS } from '@/components/coordinator/wizard/wizard-time-options'
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
  /** Listing-aware schedule (quarter auctions are always single-day). */
  effectiveScheduleType: 'single' | 'multi'
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
  vendorPaymentMethods: VendorPaymentMethodKey[]
  onVendorPaymentMethodsChange: (methods: VendorPaymentMethodKey[]) => void
}

export function WizardStepEventDetailsQa(props: WizardStepEventDetailsProps) {
  function updateDayRow(index: number, field: keyof DayRow, value: string) {
    props.onDayRowsChange(
      props.dayRows.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  function addDayRow() {
    props.onDayRowsChange([...props.dayRows, buildNextEventDayRow(props.dayRows)])
  }

  function removeDayRow(index: number) {
    props.onDayRowsChange(props.dayRows.filter((_, i) => i !== index))
  }

  const autoFilled = props.autoFilledFields ?? new Set<FlyerFieldKey>()

  return (
    <div className="wizard-step1-deck relative space-y-4">
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
        <div>
          <p className="text-[0.625rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Step 1
          </p>
          <h2 className="font-heading text-[clamp(1.25rem,1.2vw+1rem,1.75rem)] font-bold tracking-tight text-forest">
            Launch your market
          </h2>
        </div>
        <span className={WIZARD_DRAFT_BADGE} aria-label="Event status">
          Draft
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <WizardZone
          id="wizard-zone-identity"
          title="Identity & story"
          subtitle="What vendors and shoppers see first — name and description are required."
        >
          <FlyerCoverUpload
            coverImageUrl={props.coverImageUrl}
            onFileSelected={props.onCoverFileSelected}
            parsing={props.parsingFlyer}
            label="Cover image / flyer"
          />
          <FlyerFieldHighlight fieldKey="name" autoFilledFields={autoFilled}>
            <WizardFloatingInput
              id="wizard-event-name"
              label="Event name *"
              value={props.name}
              onChange={(e) => props.onNameChange(e.target.value)}
            />
          </FlyerFieldHighlight>
          <FlyerFieldHighlight fieldKey="description" autoFilledFields={autoFilled}>
            <WizardDescriptionFieldQa
              id="wizard-description"
              label="Description *"
              value={props.description}
              onChange={props.onDescriptionChange}
            />
          </FlyerFieldHighlight>
        </WizardZone>

        <WizardZone
          id="wizard-zone-schedule"
          title="Schedule & booking"
          subtitle="When the market runs and how vendors get approved."
        >
          <div className="space-y-2">
            <Label className={WIZARD_FIELD_LABEL}>Listing type</Label>
            <WizardSelectionGroup label="Listing type">
              <WizardSelectionCard
                selected={props.listingType === 'community_market'}
                onSelect={() => props.onListingTypeChange('community_market')}
                aria-label="Community Market"
              >
                <span className="block text-left font-semibold">Community market</span>
                <span className="mt-1 block text-left text-xs font-normal text-muted-foreground">
                  Booths, floor plan, Square or offline pay
                </span>
              </WizardSelectionCard>
              <WizardSelectionCard
                selected={props.listingType === 'garage_yard_sale'}
                onSelect={() => props.onListingTypeChange('garage_yard_sale')}
                aria-label="Quarter Auction"
              >
                <span className="block text-left font-semibold">Quarter auction</span>
                <span className="mt-1 block text-left text-xs font-normal text-muted-foreground">
                  Single day · live auction from dashboard
                </span>
              </WizardSelectionCard>
            </WizardSelectionGroup>
            {props.listingType === 'garage_yard_sale' ? (
              <p className={WIZARD_INFO_BOX}>
                Quarter auctions appear on the patron map when published. Vendor applications are required;
                there is no floor-plan booth placement — set caps on step 3.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label className={WIZARD_FIELD_LABEL}>Schedule type</Label>
        {props.listingType === 'garage_yard_sale' ? (
          <p className={WIZARD_INFO_BOX}>
            Quarter auctions are limited to a single day. Multi-day scheduling is not available for this
            listing type.
          </p>
        ) : (
          <WizardSelectionGroup label="Schedule type">
            {(['single', 'multi'] as const).map((type) => (
              <WizardSelectionCard
                key={type}
                selected={props.scheduleType === type}
                onSelect={() => props.onScheduleTypeChange(type)}
                aria-label={type === 'single' ? 'Single Day' : 'Multi-Day'}
              >
                {type === 'single' ? 'Single Day' : 'Multi-Day'}
              </WizardSelectionCard>
            ))}
          </WizardSelectionGroup>
        )}
        <ScheduleWeekendShortcuts
          variant="wizard"
          scheduleType={
            isQuarterAuctionListing(props.listingType) ? 'single' : props.scheduleType
          }
          onApply={props.onApplyWeekendRange}
        />
      </div>

      {props.effectiveScheduleType === 'single' ? (
        // On mobile: single column so each Date+Time stack uses the
        // full row width — narrow phones can't fit two `min-w-[200px]`
        // selects side by side. From sm: two columns side by side.
        // Within each cell the date input + time select stack at full
        // width via `w-full` on the time trigger (overriding the
        // shared `min-w-[200px]` so it can shrink in tight cells).
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FlyerFieldHighlight fieldKey="startDate" autoFilledFields={autoFilled}>
            <div className="space-y-1 min-w-0">
              <Label htmlFor="wizard-start-date" className={WIZARD_FIELD_LABEL}>Start Date & Time *</Label>
              <Input
                id="wizard-start-date"
                type="date"
                value={props.startDate}
                onChange={(e) => props.onStartDateChange(e.target.value)}
                className={cn(WIZARD_INPUT, 'w-full')}
              />
              <FlyerFieldHighlight fieldKey="startTime" autoFilledFields={autoFilled} className="!p-0 !m-0 !ring-0 !bg-transparent">
                <Select
                  value={props.startTime}
                  onValueChange={(v) => {
                    const next = selectValueOrNull(v)
                    if (next) props.onStartTimeChange(next)
                  }}
                >
                  <SelectTrigger className={cn(WIZARD_SELECT_TRIGGER, 'w-full !min-w-0')}>
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
            <div className="space-y-1 min-w-0">
              <Label htmlFor="wizard-end-date" className={WIZARD_FIELD_LABEL}>End Date & Time *</Label>
              <Input
                id="wizard-end-date"
                type="date"
                value={props.endDate}
                min={props.startDate}
                onChange={(e) => props.onEndDateChange(e.target.value)}
                className={cn(WIZARD_INPUT, 'w-full')}
              />
              <FlyerFieldHighlight fieldKey="endTime" autoFilledFields={autoFilled} className="!p-0 !m-0 !ring-0 !bg-transparent">
                <Select
                  value={props.endTime}
                  onValueChange={(v) => {
                    const next = selectValueOrNull(v)
                    if (next) props.onEndTimeChange(next)
                  }}
                >
                  <SelectTrigger className={cn(WIZARD_SELECT_TRIGGER, 'w-full !min-w-0')}>
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
            // Mobile-first multi-day row: a 2-row grid on phones
            // (date + delete on top, start–to–end on the next line)
            // and a single horizontal row on `sm`+. The previous fixed
            // widths (`w-40`/`w-36`) and the inherited `min-w-[200px]`
            // from `WIZARD_SELECT_TRIGGER` summed to ~560px, well over
            // a 375px iPhone viewport, which forced ugly mid-control
            // wrapping (and the trash icon orphaned on its own line).
            <div
              key={`day-${i}`}
              className={cn(
                'grid items-center gap-2',
                'grid-cols-[1fr_auto]',
                'sm:flex sm:flex-wrap'
              )}
            >
              <Input
                id={i === 0 ? 'wizard-day-0-date' : `wizard-day-${i}-date`}
                type="date"
                value={row.date}
                onChange={(e) => updateDayRow(i, 'date', e.target.value)}
                className={cn(WIZARD_INPUT, 'w-full sm:w-40 sm:shrink-0')}
              />
              {props.dayRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() => removeDayRow(i)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 sm:order-last"
                  aria-label="Remove day"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
              <div className="col-span-2 flex items-center gap-2 sm:contents">
                <Select
                  value={row.start_time}
                  onValueChange={(v) => {
                    const next = selectValueOrNull(v)
                    if (next) updateDayRow(i, 'start_time', next)
                  }}
                >
                  <SelectTrigger className={cn(WIZARD_SELECT_TRIGGER, 'flex-1 !min-w-0 sm:flex-none sm:w-36')}>
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
                <span className="text-muted-foreground text-sm shrink-0">to</span>
                <Select
                  value={row.end_time}
                  onValueChange={(v) => {
                    const next = selectValueOrNull(v)
                    if (next) updateDayRow(i, 'end_time', next)
                  }}
                >
                  <SelectTrigger className={cn(WIZARD_SELECT_TRIGGER, 'flex-1 !min-w-0 sm:flex-none sm:w-36')}>
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
              </div>
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
        <WizardSwitchRow
          id="wizard-require-full-attendance"
          label="Require attendance for all event days"
          description="Turn this off if vendors are allowed to apply for single or partial days."
          control={
            <Switch
              id="wizard-require-full-attendance"
              checked={props.requireFullAttendance}
              onCheckedChange={props.onRequireFullAttendanceChange}
            />
          }
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </WizardZone>
      </div>

      <WizardZone
        id="wizard-zone-rules"
        title="Vendor rules & payments"
        subtitle="Insurance, MLM policy, and checkout options vendors will see."
        variant="wide"
      >
        <div className="space-y-4">
          <WizardSwitchRow
            id="wizard-market-insurance-required"
            label="Require market insurance"
            description="Approved vendors upload proof of insurance before their booth is finalized."
            control={
              <Switch
                id="wizard-market-insurance-required"
                checked={props.marketInsuranceRequired}
                onCheckedChange={props.onMarketInsuranceRequiredChange}
              />
            }
          />
          {props.listingType === 'community_market' ? (
            <>
              <WizardSwitchRow
                id="wizard-allow-mlm"
                label="Allow direct sales / MLM vendors"
                description="Recommended for most community markets — enables MLM categories in step 2."
                control={
                  <Switch
                    id="wizard-allow-mlm"
                    checked={props.allowMlm}
                    onCheckedChange={props.onAllowMlmChange}
                  />
                }
              />
              <FlyerFieldHighlight fieldKey="raffleDonationRequirement" autoFilledFields={autoFilled}>
                <WizardFloatingTextarea
                  id="wizard-raffle"
                  label="Raffle donation requirement"
                  value={props.raffleDonationRequirement}
                  onChange={(e) => props.onRaffleDonationRequirementChange(e.target.value)}
                  rows={2}
                />
              </FlyerFieldHighlight>
            </>
          ) : null}
        </div>
        <div className="wizard-glass-inset p-4">
          <WizardPaymentPreviewStripQa
            selectedMethods={props.vendorPaymentMethods}
            onSelectedMethodsChange={props.onVendorPaymentMethodsChange}
          />
        </div>
      </WizardZone>
    </div>
  )
}
