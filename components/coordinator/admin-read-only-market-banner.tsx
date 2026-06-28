import { Eye } from 'lucide-react'

interface AdminReadOnlyMarketBannerProps {
  ownerName: string
}

export function AdminReadOnlyMarketBanner({ ownerName }: AdminReadOnlyMarketBannerProps) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
      role="status"
    >
      <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Viewing as platform admin</span>
        {' — '}
        This market belongs to <span className="font-medium">{ownerName}</span>. You can inspect it
        but cannot edit or publish it.
      </p>
    </div>
  )
}
