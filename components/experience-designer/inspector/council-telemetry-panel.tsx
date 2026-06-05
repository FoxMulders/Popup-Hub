'use client'

import { Activity, Bot, Gauge, Sparkles } from 'lucide-react'
import type { CouncilTelemetry, ExperienceConstraints } from '@/lib/experience-designer/types'

const THEME_LABELS: Record<ExperienceConstraints['theme'], string> = {
  haunted_manor: 'Haunted Manor',
  cyber_heist: 'Cyber Heist',
  pirate_vault: 'Pirate Vault',
  space_station: 'Space Station',
}

const VENUE_LABELS: Record<ExperienceConstraints['venueType'], string> = {
  popup_trailer: 'Popup Trailer',
  warehouse: 'Warehouse Bay',
  retail_suite: 'Retail Suite',
  outdoor_pavilion: 'Outdoor Pavilion',
}

const DEPLOYMENT_LABELS: Record<ExperienceConstraints['deploymentMode'], string> = {
  home: 'Home party',
  commercial: 'Commercial venue',
}

export interface CouncilTelemetryPanelProps {
  telemetry: CouncilTelemetry
  constraints: ExperienceConstraints
}

export function CouncilTelemetryPanel({
  telemetry,
  constraints,
}: CouncilTelemetryPanelProps) {
  const statusLabel =
    telemetry.councilStatus === 'idle'
      ? 'Standing by'
      : telemetry.councilStatus === 'generating'
        ? 'Generating…'
        : telemetry.councilStatus === 'reviewing'
          ? 'Council review'
          : 'Ready'

  const report = telemetry.councilReport

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">Council Telemetry</h2>
        </div>
        <p className="mt-1 text-xs text-white/45">Live design council activity and session context</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Session constraints
          </p>
          <dl className="mt-2 space-y-1.5 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-white/50">Theme</dt>
              <dd className="font-medium text-white">{THEME_LABELS[constraints.theme]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/50">Venue</dt>
              <dd className="font-medium text-white">{VENUE_LABELS[constraints.venueType]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/50">Deployment</dt>
              <dd className="font-medium text-white">
                {DEPLOYMENT_LABELS[constraints.deploymentMode]}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-white/50">Players</dt>
              <dd className="font-medium tabular-nums text-white">
                {constraints.targetPlayerCount}
              </dd>
            </div>
          </dl>
        </section>

        <section className="grid grid-cols-2 gap-2">
          <TelemetryStat icon={Activity} label="Status" value={statusLabel} />
          <TelemetryStat
            icon={Gauge}
            label="Consensus"
            value={`${telemetry.consensusScore}%`}
          />
          <TelemetryStat
            icon={Bot}
            label="Tokens"
            value={telemetry.tokensUsed.toLocaleString()}
          />
          <TelemetryStat
            icon={Sparkles}
            label="Agents"
            value={String(report?.verdicts?.length ?? telemetry.activeAgents.length)}
          />
        </section>

        {report ? (
          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Council summary
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-white/45">Avg score</dt>
                <dd className="font-semibold tabular-nums text-white">
                  {report.averageScore.toFixed(1)}/10
                </dd>
              </div>
              <div>
                <dt className="text-white/45">Wow votes</dt>
                <dd className="font-semibold tabular-nums text-white">{report.wowCount}/10</dd>
              </div>
              <div>
                <dt className="text-white/45">Iterations</dt>
                <dd className="font-semibold tabular-nums text-white">{report.iterations}</dd>
              </div>
              <div>
                <dt className="text-white/45">Verdict</dt>
                <dd className="font-semibold text-white">{report.passed ? 'Passed' : 'Revising'}</dd>
              </div>
            </dl>
            {report.revisionNotes ? (
              <p className="mt-2 text-xs leading-relaxed text-white/60">{report.revisionNotes}</p>
            ) : null}
          </section>
        ) : null}

        {report?.verdicts?.length ? (
          <section className="min-h-[8rem]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Council of Ten
            </p>
            <ul className="mt-2 space-y-2">
              {report.verdicts.map((verdict) => (
                <li
                  key={verdict.personaId}
                  className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white/85">{verdict.title}</span>
                    <span className="text-xs tabular-nums text-sky-300">
                      {verdict.score.toFixed(1)}/10
                      {verdict.wowFactor ? ' · wow' : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                    {verdict.criticalFeedback}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : telemetry.activeAgents.length > 0 ? (
          <section className="min-h-[6rem]">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              Active agents
            </p>
            <ul className="mt-2 space-y-1.5">
              {telemetry.activeAgents.map((agent) => (
                <li
                  key={agent}
                  className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs text-white/75"
                >
                  {agent}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {telemetry.lastAction ? (
          <section className="min-h-[4.5rem] rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-300/70">
              Last action
            </p>
            <p className="mt-1 text-xs leading-relaxed text-white/70">{telemetry.lastAction}</p>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function TelemetryStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1.5 text-white/45">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  )
}
