'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, Search, UserPlus } from 'lucide-react'
import type { PatronLookupResult } from '@/lib/coordinator/patron-lookup'
import { formatCredits } from '@/lib/quarter-auction/credits'
import { formatCents } from '@/lib/square/client'
import { toast } from 'sonner'

interface PatronLookupFieldProps {
  eventId?: string
  selectedPatronId?: string | null
  onSelect: (patron: PatronLookupResult) => void
  onClear?: () => void
  allowWalkUpCreate?: boolean
}

export function PatronLookupField({
  eventId,
  selectedPatronId,
  onSelect,
  onClear,
  allowWalkUpCreate = true,
}: PatronLookupFieldProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PatronLookupResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedPatron, setSelectedPatron] = useState<PatronLookupResult | null>(null)
  const [walkUpName, setWalkUpName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showWalkUp, setShowWalkUp] = useState(false)
  const searchSeq = useRef(0)

  useEffect(() => {
    if (!selectedPatronId) {
      setSelectedPatron(null)
      return
    }
    if (selectedPatron?.id === selectedPatronId) return

    let cancelled = false
    void (async () => {
      if (!eventId) return
      const res = await fetch(
        `/api/coordinator/quarter-auction/${eventId}/assist?patronUserId=${encodeURIComponent(selectedPatronId)}`
      )
      if (cancelled || !res.ok) return
      const json = (await res.json()) as { patron?: PatronLookupResult }
      if (json.patron) setSelectedPatron(json.patron)
    })()

    return () => {
      cancelled = true
    }
  }, [selectedPatronId, eventId, selectedPatron?.id])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setSearchError(null)
      setLoading(false)
      return
    }

    const seq = ++searchSeq.current
    const timer = setTimeout(async () => {
      setLoading(true)
      setSearchError(null)
      try {
        const params = new URLSearchParams({ q: trimmed })
        if (eventId) params.set('eventId', eventId)
        const res = await fetch(`/api/coordinator/patron-lookup?${params}`)
        const json = (await res.json()) as { patrons?: PatronLookupResult[]; error?: string }

        if (seq !== searchSeq.current) return

        if (!res.ok) {
          setResults([])
          setSearchError(json.error ?? 'Search failed')
          if (res.status === 401 || res.status === 403) {
            toast.error('Session expired — sign in again as coordinator')
          }
          return
        }

        setResults(json.patrons ?? [])
      } catch {
        if (seq !== searchSeq.current) return
        setResults([])
        setSearchError('Network error — try again')
      } finally {
        if (seq === searchSeq.current) setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, eventId])

  function selectPatron(patron: PatronLookupResult) {
    setSelectedPatron(patron)
    onSelect(patron)
    setQuery(patron.full_name ?? patron.email ?? '')
    setResults([])
    setSearchError(null)
  }

  function clearSelection() {
    setSelectedPatron(null)
    setQuery('')
    setResults([])
    setSearchError(null)
    onClear?.()
  }

  async function createWalkUp() {
    const name = walkUpName.trim()
    if (name.length < 2) {
      toast.error('Enter the patron’s name (at least 2 characters)')
      return
    }
    if (creating) return

    setCreating(true)
    try {
      const res = await fetch('/api/coordinator/walk-up-patron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: name }),
      })
      const json = (await res.json()) as {
        error?: string
        patron?: { id: string; full_name: string; email: string; walletNumber: string | null }
      }
      if (!res.ok || !json.patron) {
        toast.error(json.error ?? 'Could not create walk-up account')
        return
      }

      toast.success(`Walk-up account created — wallet #${json.patron.walletNumber ?? 'pending'}`)

      selectPatron({
        id: json.patron.id,
        full_name: json.patron.full_name,
        email: json.patron.email,
        walletBalanceCents: 0,
        walletBalanceCredits: 0,
        walletNumber: json.patron.walletNumber,
        participated: false,
        paddles: [],
      })
      setShowWalkUp(false)
      setWalkUpName('')
    } finally {
      setCreating(false)
    }
  }

  const showEmpty =
    !loading && query.trim().length >= 2 && results.length === 0 && !searchError && !selectedPatron

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="patron-search">Find patron (name, email, wallet #, or ID)</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="patron-search"
            className="min-h-11 pl-9"
            placeholder="e.g. Jane Smith or 4821"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={creating}
          />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        {searchError ? <p className="text-xs text-destructive">{searchError}</p> : null}
      </div>

      {results.length > 0 ? (
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-white p-1">
          {results.map((patron) => (
            <li key={patron.id}>
              <button
                type="button"
                className={`w-full rounded-md px-3 py-2 text-left text-sm hover:bg-canvas ${
                  selectedPatronId === patron.id ? 'bg-harvest-50 ring-1 ring-harvest-300' : ''
                }`}
                onClick={() => selectPatron(patron)}
              >
                <span className="font-medium">{patron.full_name ?? 'Patron'}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {patron.walletNumber ? `#${patron.walletNumber} · ` : ''}
                  {formatCredits(patron.walletBalanceCredits)} ({formatCents(patron.walletBalanceCents)})
                  {eventId && patron.participated ? ' · checked in' : ''}
                  {patron.paddles.length > 0 ? ` · ${patron.paddles.length} paddle(s)` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showEmpty ? (
        <p className="rounded-lg border border-dashed bg-white px-3 py-2 text-sm text-muted-foreground">
          No patrons matched &ldquo;{query.trim()}&rdquo;. Try another spelling or create a walk-up
          account below.
        </p>
      ) : null}

      {selectedPatronId && onClear ? (
        <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
          Clear selection
        </Button>
      ) : null}

      {allowWalkUpCreate ? (
        <div className="rounded-lg border border-dashed bg-canvas/60 p-3 space-y-2">
          {!showWalkUp ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={creating}
              onClick={() => setShowWalkUp(true)}
            >
              <UserPlus className="h-4 w-4" />
              New walk-up (no phone / no account)
            </Button>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Create a desk account — staff handle wallet, paddles, and bids. Give the patron their
                wallet number to reclaim balance at exit.
              </p>
              <Input
                placeholder="Patron name"
                value={walkUpName}
                onChange={(e) => setWalkUpName(e.target.value)}
                className="min-h-10"
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void createWalkUp()
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={creating || walkUpName.trim().length < 2}
                  onClick={() => void createWalkUp()}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create & select'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={creating}
                  onClick={() => setShowWalkUp(false)}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {selectedPatron && selectedPatronId ? (
        <div className="rounded-lg border bg-white px-3 py-2 text-sm">
          <p className="font-medium">{selectedPatron.full_name ?? 'Patron'}</p>
          <p className="text-xs text-muted-foreground">
            Wallet{' '}
            {selectedPatron.walletNumber
              ? `#${selectedPatron.walletNumber}`
              : selectedPatron.id.slice(0, 8)}
            {' · '}
            {formatCredits(selectedPatron.walletBalanceCredits)}
          </p>
        </div>
      ) : null}
    </div>
  )
}
