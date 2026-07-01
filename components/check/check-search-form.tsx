'use client'

import { useRouter } from 'next/navigation'
import { FormEvent, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { resetScrollToTop } from '@/lib/navigation/scroll-to-top'

type Props = {
  initialQuery: string
  region: string
}

export function CheckSearchForm({ initialQuery, region }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (region) params.set('region', region)
    resetScrollToTop()
    router.push(`/check?${params.toString()}`, { scroll: false })
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search organizer or market name…"
          className="pl-9"
          aria-label="Search organizers"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  )
}
