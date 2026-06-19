'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { BoothContractClause } from '@/types/database'

interface GoogleDocListItem {
  id: string
  name: string
  modifiedTime?: string
}

export interface GoogleDocsContractImportProps {
  onImportClauses: (clauses: BoothContractClause[]) => void
  disabled?: boolean
}

export function GoogleDocsContractImport({
  onImportClauses,
  disabled = false,
}: GoogleDocsContractImportProps) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [docs, setDocs] = useState<GoogleDocListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const refreshDocs = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/coordinator/google/docs')
    const json = (await res.json()) as {
      connected?: boolean
      docs?: GoogleDocListItem[]
      error?: string
    }
    setLoading(false)
    if (!res.ok) {
      toast.error(json.error ?? 'Could not load Google Docs')
      return
    }
    setConnected(json.connected ?? false)
    setDocs(json.docs ?? [])
  }, [])

  useEffect(() => {
    if (pickerOpen) void refreshDocs()
  }, [pickerOpen, refreshDocs])

  async function importDoc(docId: string) {
    setImportingId(docId)
    const res = await fetch('/api/coordinator/google/docs/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
    })
    setImportingId(null)
    const json = (await res.json()) as { clauses?: BoothContractClause[]; error?: string }
    if (!res.ok || !json.clauses) {
      toast.error(json.error ?? 'Import failed')
      return
    }
    onImportClauses(json.clauses)
    setPickerOpen(false)
    toast.success(`Imported ${json.clauses.length} contract clause${json.clauses.length === 1 ? '' : 's'}`)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => {
          if (connected === false) {
            window.location.href = '/api/coordinator/google/oauth/start'
            return
          }
          setPickerOpen(true)
        }}
      >
        <FileText className="h-4 w-4" />
        Import from Google Docs
      </Button>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose a Google Doc</DialogTitle>
            <DialogDescription>
              Import contract clauses from a Doc in your connected Google account.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto py-2">
            {loading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading docs…
              </p>
            ) : connected === false ? (
              <p className="text-sm text-muted-foreground">
                Connect Google to browse your Docs.
              </p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Google Docs found.</p>
            ) : (
              docs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm hover:bg-canvas"
                  disabled={importingId === doc.id}
                  onClick={() => void importDoc(doc.id)}
                >
                  <span className="font-medium">{doc.name}</span>
                  {importingId === doc.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            {connected === false ? (
              <a
                href="/api/coordinator/google/oauth/start"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Connect Google
              </a>
            ) : (
              <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
