'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ExperienceConstraints } from '@/lib/experience-designer/types'

const THEMES: { value: ExperienceConstraints['theme']; label: string }[] = [
  { value: 'haunted_manor', label: 'Haunted Manor' },
  { value: 'cyber_heist', label: 'Cyber Heist' },
  { value: 'pirate_vault', label: 'Pirate Vault' },
  { value: 'space_station', label: 'Space Station' },
]

const VENUE_TYPES: { value: ExperienceConstraints['venueType']; label: string }[] = [
  { value: 'popup_trailer', label: 'Popup Trailer' },
  { value: 'warehouse', label: 'Warehouse Bay' },
  { value: 'retail_suite', label: 'Retail Suite' },
  { value: 'outdoor_pavilion', label: 'Outdoor Pavilion' },
]

const PLAYER_COUNTS = [2, 4, 6, 8, 10, 12]

const DEPLOYMENT_MODES: { value: ExperienceConstraints['deploymentMode']; label: string }[] = [
  { value: 'commercial', label: 'Commercial venue' },
  { value: 'home', label: 'Home party' },
]

export interface StepConstraintsPanelProps {
  constraints: ExperienceConstraints
  onChange: (constraints: ExperienceConstraints) => void
  onContinue: () => void
}

export function StepConstraintsPanel({
  constraints,
  onChange,
  onContinue,
}: StepConstraintsPanelProps) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        step={1}
        title="Constraints"
        subtitle="Theme, venue envelope, player count, and home vs commercial constraints drive council generation."
      />
      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Field label="Theme">
          <Select
            value={constraints.theme}
            onValueChange={(value) =>
              onChange({ ...constraints, theme: value as ExperienceConstraints['theme'] })
            }
          >
            <SelectTrigger className="w-full border-white/15 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEMES.map((theme) => (
                <SelectItem key={theme.value} value={theme.value}>
                  {theme.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Venue type">
          <Select
            value={constraints.venueType}
            onValueChange={(value) =>
              onChange({
                ...constraints,
                venueType: value as ExperienceConstraints['venueType'],
              })
            }
          >
            <SelectTrigger className="w-full border-white/15 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VENUE_TYPES.map((venue) => (
                <SelectItem key={venue.value} value={venue.value}>
                  {venue.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Deployment mode">
          <Select
            value={constraints.deploymentMode}
            onValueChange={(value) =>
              onChange({
                ...constraints,
                deploymentMode: value as ExperienceConstraints['deploymentMode'],
              })
            }
          >
            <SelectTrigger className="w-full border-white/15 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DEPLOYMENT_MODES.map((mode) => (
                <SelectItem key={mode.value} value={mode.value}>
                  {mode.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Target player count">
          <Select
            value={String(constraints.targetPlayerCount)}
            onValueChange={(value) =>
              onChange({ ...constraints, targetPlayerCount: Number(value) })
            }
          >
            <SelectTrigger className="w-full border-white/15 bg-white/5 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYER_COUNTS.map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count} players
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <PanelFooter>
        <button
          type="button"
          onClick={onContinue}
          className="touch-target w-full min-h-12 rounded-lg bg-sky-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 touch-manipulation"
        >
          Continue to spatial layout
        </button>
      </PanelFooter>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-white/70">{label}</Label>
      {children}
    </div>
  )
}

function PanelHeader({
  step,
  title,
  subtitle,
}: {
  step: number
  title: string
  subtitle: string
}) {
  return (
    <div className="border-b border-white/10 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
        Step {step}
      </p>
      <h2 className="mt-0.5 text-base font-semibold text-white">{title}</h2>
      <p className="mt-1 text-xs leading-relaxed text-white/45">{subtitle}</p>
    </div>
  )
}

function PanelFooter({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-white/10 p-4">{children}</div>
}

export { PanelHeader, PanelFooter, Field }
