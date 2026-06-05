'use client'

import { ExternalLink, Package } from 'lucide-react'
import { AMAZON_ASSOCIATE_DISCLOSURE } from '@/lib/affiliate/amazon'
import type { MaterialChecklistLinkItem } from '@/lib/experience-designer/material-checklist-schema'

export interface MaterialChecklistPanelProps {
  items: MaterialChecklistLinkItem[]
  title?: string
}

function MaterialRow({ item }: { item: MaterialChecklistLinkItem }) {
  return (
    <li className="rounded-md border border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs">
      <div className="flex gap-3">
        {item.image_url ? (
          <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/30 p-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.image_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-white">{item.name}</p>
            <span
              className={
                item.required
                  ? 'rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200'
                  : 'rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white/45'
              }
            >
              {item.required ? 'Required' : 'Optional'}
            </span>
          </div>
          {item.display_note ? (
            <p className="mt-0.5 text-white/50">{item.display_note}</p>
          ) : null}
          {item.affiliate_url ? (
            <a
              href={item.affiliate_url}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="mt-1.5 inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
            >
              Find on Amazon.ca
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
            </a>
          ) : (
            <p className="mt-1 text-white/40">Source locally or print in-house</p>
          )}
        </div>
      </div>
    </li>
  )
}

export function MaterialChecklistPanel({
  items,
  title = 'Material Checklist',
}: MaterialChecklistPanelProps) {
  if (!items.length) return null

  const required = items.filter((i) => i.required)
  const optional = items.filter((i) => !i.required)

  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Package className="h-4 w-4 text-amber-300" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>

      {required.length ? (
        <div className="mb-3">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/80">
            Required for this puzzle
          </p>
          <ul className="space-y-1.5">
            {required.map((item) => (
              <MaterialRow key={`req-${item.name}`} item={item} />
            ))}
          </ul>
        </div>
      ) : null}

      {optional.length ? (
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
            Optional / nice-to-have
          </p>
          <ul className="space-y-1.5">
            {optional.map((item) => (
              <MaterialRow key={`opt-${item.name}`} item={item} />
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 text-[10px] leading-snug text-white/35">{AMAZON_ASSOCIATE_DISCLOSURE}</p>
    </section>
  )
}
