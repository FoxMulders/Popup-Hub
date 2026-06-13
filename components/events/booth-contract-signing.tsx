'use client'

import { useState } from 'react'
import { ExternalLink, FileText, Printer } from 'lucide-react'
import type { BoothContractClause, BoothContractSignatureMethod } from '@/types/database'
import { BoothContractAcknowledgment } from '@/components/events/booth-contract-acknowledgment'
import { SignaturePad } from '@/components/vendor/signature-pad'
import { TouchFileInput } from '@/components/ui/touch-file-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { openBoothContractForPrint } from '@/lib/booth-contract/print-contract'

export interface BoothContractSigningValue {
  method: BoothContractSignatureMethod | null
  signedName: string
  signatureDataUrl: string | null
  signedDocumentFile: File | null
}

interface BoothContractSigningProps {
  clauses: BoothContractClause[]
  pdfUrl?: string | null
  updatedAt?: string | null
  eventName?: string
  value: BoothContractSigningValue
  onChange: (value: BoothContractSigningValue) => void
  disabled?: boolean
}

export function isBoothContractSigningComplete(value: BoothContractSigningValue): boolean {
  if (value.method === 'digital') {
    return value.signedName.trim().length > 0 && Boolean(value.signatureDataUrl)
  }
  if (value.method === 'uploaded') {
    return Boolean(value.signedDocumentFile)
  }
  return false
}

export const EMPTY_BOOTH_CONTRACT_SIGNING: BoothContractSigningValue = {
  method: 'digital',
  signedName: '',
  signatureDataUrl: null,
  signedDocumentFile: null,
}

export function BoothContractSigning({
  clauses,
  pdfUrl,
  updatedAt,
  eventName,
  value,
  onChange,
  disabled,
}: BoothContractSigningProps) {
  const [activeTab, setActiveTab] = useState<BoothContractSignatureMethod>('digital')

  function selectMethod(method: BoothContractSignatureMethod) {
    setActiveTab(method)
    onChange({
      ...value,
      method,
      signatureDataUrl: method === 'digital' ? value.signatureDataUrl : null,
      signedDocumentFile: method === 'uploaded' ? value.signedDocumentFile : null,
    })
  }

  return (
    <div className="space-y-3">
      <BoothContractAcknowledgment
        clauses={clauses}
        pdfUrl={pdfUrl}
        updatedAt={updatedAt}
      />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => selectMethod(tab as BoothContractSignatureMethod)}
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-stone-100 p-1">
          <TabsTrigger value="digital" disabled={disabled} className="text-xs py-2">
            Sign digitally
          </TabsTrigger>
          <TabsTrigger value="uploaded" disabled={disabled} className="text-xs py-2">
            Print &amp; upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="digital" className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contract-signed-name">Full legal name</Label>
            <Input
              id="contract-signed-name"
              placeholder="Name as it appears on your business"
              value={value.signedName}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, method: 'digital', signedName: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Signature</Label>
            <SignaturePad
              disabled={disabled}
              onChange={(hasSignature, dataUrl) =>
                onChange({
                  ...value,
                  method: 'digital',
                  signatureDataUrl: hasSignature ? dataUrl : null,
                })
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your digital signature is stored with your application for the coordinator to review.
          </p>
        </TabsContent>

        <TabsContent value="uploaded" className="mt-3 space-y-3">
          <div className="rounded-lg border border-stone-200 bg-white p-3 text-xs text-muted-foreground space-y-2">
            <p className="font-medium text-foreground">Print, sign, and return</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Print the contract (or open the PDF).</li>
              <li>Sign the printed copy by hand.</li>
              <li>Scan or photograph the signed pages and upload below.</li>
            </ol>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={disabled}
              onClick={() =>
                openBoothContractForPrint({ clauses, pdfUrl, eventName })
              }
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print contract
            </Button>
            {pdfUrl ? (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-canvas"
              >
                <FileText className="h-3.5 w-3.5" />
                Open PDF
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Upload signed copy</Label>
            <TouchFileInput
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={disabled}
              onChange={(files) =>
                onChange({
                  ...value,
                  method: 'uploaded',
                  signedDocumentFile: files?.[0] ?? null,
                })
              }
              label={
                value.signedDocumentFile
                  ? `Selected: ${value.signedDocumentFile.name}`
                  : 'Tap to upload signed contract (PDF or image)'
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            The coordinator receives your signed copy with your application.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
