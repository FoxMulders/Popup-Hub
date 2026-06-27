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

function oauthStartHref(): string {
  const returnTo =
    typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : '/coordinator/events/new'
  return `/api/coordinator/google/oauth/start?return_to=${encodeURIComponent(returnTo)}`
}

export function GoogleDocsContractImport({
  onImportClauses,
  disabled = false,
}: GoogleDocsContractImportProps) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [docs, setDocs] = useState<GoogleDocListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const refreshDocs = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const res = await fetch('/api/coordinator/google/docs')
    const json = (await res.json()) as {
      connected?: boolean
      docs?: GoogleDocListItem[]
      error?: string
    }
    setLoading(false)
    if (!res.ok) {
      const msg = json.error ?? 'Could not load Google Docs'
      setLoadError(msg)
      if (res.status === 503) {
        setConnected(false)
      }
      return
    }
    setConnected(json.connected ?? false)
    setDocs(json.docs ?? [])
  }, [])

  useEffect(() => {
    if (pickerOpen) void refreshDocs()
  }, [pickerOpen, refreshDocs])

  async function startGoogleConnect() {
    setConnecting(true)
    try {
      const res = await fetch('/api/coordinator/google/status')
      const json = (await res.json()) as { configured?: boolean; authorized?: boolean; error?: string }
      if (!res.ok || !json.authorized) {
        toast.error(json.error ?? 'You must be signed in as a coordinator to connect Google.')
        return
      }
      if (!json.configured) {
        toast.error(
          'Google OAuth is not configured on this server. Ask your platform admin to set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.'
        )
        setConnectOpen(false)
        setPickerOpen(false)
        return
      }
      window.location.href = oauthStartHref()
    } catch {
      toast.error('Could not start Google connection. Try again.')
    } finally {
      setConnecting(false)
    }
  }

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

  function openFlow() {
    if (connected === false) {
      setConnectOpen(true)
      return
    }
    setPickerOpen(true)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        disabled={disabled}
        onClick={openFlow}
      >
        <FileText className="h-4 w-4" />
        Import from Google Docs
      </Button>

      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Google account</DialogTitle>
            <DialogDescription>
              You will leave this page briefly to authorize Google Docs access, then return here
              automatically.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={connecting}
              onClick={() => void startGoogleConnect()}
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Connecting…
                </>
              ) : (
                'Continue to Google'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            ) : loadError ? (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                <p>{loadError}</p>
                {loadError.includes('not configured') ? (
                  <p className="text-xs text-red-800/80">
                    Platform operators must set Google OAuth environment variables in production.
                  </p>
                ) : null}
              </div>
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
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>
              Close
            </Button>
            {connected === false || loadError ? (
              <Button
                type="button"
                disabled={connecting}
                onClick={() => void startGoogleConnect()}
              >
                {connecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Connecting…
                  </>
                ) : (
                  'Connect Google'
                )}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => void refreshDocs()}>
                Refresh
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
