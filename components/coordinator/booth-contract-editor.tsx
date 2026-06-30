'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/lib/toast'
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquarePlus,
  Plus,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  createCustomContractClause,
  mergePlatformClauseUpdates,
  normalizeEventContractClauses,
} from '@/lib/legal/booth-contract-templates'
import { enabledContractClausesForStorage } from '@/lib/booth-contract/resolve-event-contract'
import { uploadBoothContractPdf } from '@/lib/coordinator/upload-booth-contract-pdf'
import { GoogleDocsContractImport } from '@/components/coordinator/google-docs-contract-import'
import { GoogleOAuthReturnAlert } from '@/components/coordinator/google-oauth-return-alert'
import { buildBoothContractEnhancementPrefill } from '@/lib/feedback/booth-contract-enhancement-prefill'
import { useFeatureRequest } from '@/components/feedback/feature-request-context'
import type { BoothClearancePolicy, BoothContractClause } from '@/types/database'

interface BoothContractEditorProps {
  eventId: string | null
  coordinatorId: string
  eventName?: string
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
  clauses: BoothContractClause[]
  onClausesChange: (clauses: BoothContractClause[]) => void
  pdfUrl: string | null
  onPdfUrlChange: (url: string | null) => void
  requireFullAttendance: boolean
  marketInsuranceRequired: boolean
  boothClearancePolicy: BoothClearancePolicy
  contractReviewed?: boolean
  onContractReviewedChange?: (reviewed: boolean) => void
  onSaved?: () => void
  compact?: boolean
}

export function BoothContractEditor({
  eventId,
  coordinatorId,
  eventName,
  enabled,
  onEnabledChange,
  clauses,
  onClausesChange,
  pdfUrl,
  onPdfUrlChange,
  requireFullAttendance,
  marketInsuranceRequired,
  boothClearancePolicy,
  contractReviewed = false,
  onContractReviewedChange,
  onSaved,
  compact = false,
}: BoothContractEditorProps) {
  const supabase = createClient()
  const { openWithPrefill } = useFeatureRequest()
  const [saving, setSaving] = useState(false)
  const [uploadingPdf, setUploadingPdf] = useState(false)
  const [saved, setSaved] = useState(false)

  const templateContext = useMemo(
    () => ({
      requireFullAttendance,
      marketInsuranceRequired,
      boothClearancePolicy,
      eventName,
    }),
    [requireFullAttendance, marketInsuranceRequired, boothClearancePolicy, eventName]
  )

  const clausesRef = useRef(clauses)
  clausesRef.current = clauses

  useEffect(() => {
    if (clauses.length > 0) return
    onClausesChange(normalizeEventContractClauses([], templateContext))
  }, [clauses.length, onClausesChange, templateContext])

  const policySignature = `${requireFullAttendance}:${marketInsuranceRequired}:${boothClearancePolicy}`
  const lastPolicySignature = useRef(policySignature)
  useEffect(() => {
    if (lastPolicySignature.current === policySignature) return
    lastPolicySignature.current = policySignature
    if (clausesRef.current.length === 0) return
    onClausesChange(mergePlatformClauseUpdates(clausesRef.current, templateContext))
  }, [policySignature, onClausesChange, templateContext])

  const sortedClauses = useMemo(
    () => [...clauses].sort((a, b) => a.sort_order - b.sort_order),
    [clauses]
  )

  function updateClause(clauseId: string, patch: Partial<BoothContractClause>) {
    onClausesChange(
      clauses.map((clause) => (clause.id === clauseId ? { ...clause, ...patch } : clause))
    )
  }

  function moveClause(clauseId: string, direction: -1 | 1) {
    const ordered = [...sortedClauses]
    const index = ordered.findIndex((clause) => clause.id === clauseId)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ordered.length) return
    const next = [...ordered]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    onClausesChange(next.map((clause, sortOrder) => ({ ...clause, sort_order: sortOrder })))
  }

  function removeClause(clauseId: string) {
    const clause = clauses.find((item) => item.id === clauseId)
    if (!clause || clause.source !== 'custom') return
    onClausesChange(
      clauses
        .filter((item) => item.id !== clauseId)
        .map((item, index) => ({ ...item, sort_order: index }))
    )
  }

  function addCustomClause() {
    const nextOrder = clauses.reduce((max, clause) => Math.max(max, clause.sort_order), -1) + 1
    onClausesChange([...clauses, createCustomContractClause(nextOrder)])
  }

  async function saveContract() {
    if (!eventId) {
      onContractReviewedChange?.(true)
      toast.success('Booth contract settings saved for this draft')
      return
    }

    setSaving(true)
    setSaved(false)
    const payload = {
      booth_contract_enabled: enabled,
      booth_contract_clauses: enabledContractClausesForStorage(clauses),
      booth_contract_pdf_url: pdfUrl,
      booth_contract_updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('events').update(payload).eq('id', eventId)
    setSaving(false)
    if (error) {
      toast.error('Could not save booth contract')
      return
    }
    setSaved(true)
    onContractReviewedChange?.(true)
    onSaved?.()
    toast.success('Digital booth contract saved')
    setTimeout(() => setSaved(false), 2000)
  }

  async function handlePdfUpload(file: File | null) {
    if (!file) return
    if (!eventId) {
      toast.error('Save the market draft first, then attach a PDF contract.')
      return
    }
    setUploadingPdf(true)
    try {
      const url = await uploadBoothContractPdf(supabase, coordinatorId, eventId, file)
      onPdfUrlChange(url)
      toast.success('Contract PDF attached')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'PDF upload failed')
    } finally {
      setUploadingPdf(false)
    }
  }

  function suggestEnhancement() {
    const prefill = buildBoothContractEnhancementPrefill({
      eventName,
      enabledClauseCount: sortedClauses.filter((clause) => clause.enabled).length,
      customClauseCount: sortedClauses.filter((clause) => clause.source === 'custom').length,
      hasPdf: Boolean(pdfUrl),
    })
    openWithPrefill(prefill)
  }

  return (
    <div className={cn('space-y-4', compact ? '' : 'rounded-xl border bg-white p-4 shadow-sm')}>
      <GoogleOAuthReturnAlert />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-foreground">Digital booth contract</h3>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Vendors review and accept these terms when applying. Platform defaults are included —
            toggle sections, add your own clauses, or attach a PDF supplement.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-harvest-500" />}
          {saved && !saving && <CheckCircle2 className="h-4 w-4 text-green-500" />}
          <Switch checked={enabled} onCheckedChange={onEnabledChange} aria-label="Enable booth contract" />
        </div>
      </div>

      {enabled ? (
        <>
          <div className="space-y-3">
            {sortedClauses.map((clause) => (
              <div key={clause.id} className="rounded-lg border border-stone-200 bg-canvas/40 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Switch
                    checked={clause.enabled}
                    onCheckedChange={(checked) => updateClause(clause.id, { enabled: checked })}
                    aria-label={`Enable ${clause.title}`}
                  />
                  <Input
                    value={clause.title}
                    onChange={(event) => updateClause(clause.id, { title: event.target.value })}
                    className="h-8 flex-1 min-w-[12rem] text-sm font-medium"
                    disabled={clause.source === 'platform'}
                  />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {clause.source === 'platform' ? 'Platform' : 'Custom'}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveClause(clause.id, -1)}
                      aria-label="Move clause up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => moveClause(clause.id, 1)}
                      aria-label="Move clause down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    {clause.source === 'custom' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-terracotta-600"
                        onClick={() => removeClause(clause.id)}
                        aria-label="Remove custom clause"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
                <Textarea
                  value={clause.body}
                  onChange={(event) => updateClause(clause.id, { body: event.target.value })}
                  rows={clause.source === 'custom' ? 3 : 2}
                  readOnly={clause.source === 'platform'}
                  className={cn('text-sm', clause.source === 'platform' && 'bg-white')}
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={addCustomClause}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add custom clause
            </Button>
            <GoogleDocsContractImport
              onImportClauses={(imported) => {
                const baseOrder = clauses.length
                onClausesChange([
                  ...clauses,
                  ...imported.map((clause, index) => ({
                    ...clause,
                    sort_order: baseOrder + index,
                    source: 'custom' as const,
                  })),
                ])
                onContractReviewedChange?.(false)
              }}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-stone-200 p-3">
            <Label htmlFor="booth-contract-pdf" className="text-sm font-medium">
              Optional PDF attachment
            </Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="booth-contract-pdf"
                type="file"
                accept="application/pdf"
                disabled={uploadingPdf}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  void handlePdfUpload(file)
                  event.target.value = ''
                }}
                className="max-w-sm"
              />
              {uploadingPdf ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              {pdfUrl ? (
                <>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-harvest-700 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    View PDF
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onPdfUrlChange(null)}>
                    Remove PDF
                  </Button>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Attach your full legal agreement if it extends beyond the clauses above.
                </p>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Booth contracts are disabled — vendors will only see the standard attendance acknowledgment.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => void saveContract()} disabled={saving || uploadingPdf}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Save booth contract
        </Button>
        <Button type="button" variant="outline" onClick={suggestEnhancement}>
          <MessageSquarePlus className="mr-1.5 h-4 w-4" />
          Suggest an enhancement
        </Button>
      </div>

      {contractReviewed ? (
        <p className="text-xs text-sage-700">Contract reviewed for this market.</p>
      ) : null}
    </div>
  )
}
